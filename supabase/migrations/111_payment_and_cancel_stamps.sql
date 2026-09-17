-- ============================================================
-- Migration 111: Datas de cada pagamento + fase em que a encomenda foi
--                cancelada (carimbos por trigger + preenchimento do
--                histórico a partir do audit_log)
-- ============================================================
-- Contexto (sessão 174, 17/09/2026). Até aqui a receita contava pela DATA
-- DO EVENTO: uma noiva de Dezembro que pagou o sinal em Setembro contava
-- em Dezembro, e "receita do mês" não dizia quanto dinheiro tinha entrado.
-- Os pagamentos são guardados só como percentagem (30/70/100), sem data.
--
-- O que faz:
--   1. orders.deposit_paid_at / second_paid_at / fully_paid_at — momento em
--      que o pagamento passou a 30% / 70% / 100% (a 1.ª parcela é 30% do
--      orçamento, a 2.ª 40%, a 3.ª 30%; lógica em src/lib/finance.ts).
--   2. orders.cancelled_at / cancelled_from_status — quando foi cancelada e
--      em que estado estava (para as Métricas dizerem em que fase se perdem
--      encomendas).
--   3. Trigger BEFORE INSERT/UPDATE que carimba tudo sozinho, seja qual for
--      o caminho que muda o payment_status (workbench, CSV, SQL). Recuar o
--      pagamento (corrigir um clique errado) limpa os carimbos acima do
--      nível novo; voltar a subir carimba de novo.
--   4. Preenche o histórico a partir do audit_log (que guarda a linha
--      inteira em cada UPDATE desde a mig 001): para cada nível, a ÚLTIMA
--      vez que o pagamento subiu de baixo desse nível para ele (ignora
--      cliques errados entretanto revertidos). Encomendas sem histórico
--      (importadas do Monday) ficam a NULL e o código cai na data do
--      evento, como antes.
--
-- Ordem de deploy: INDIFERENTE. O código lê estas colunas com select("*")
-- e trata NULL/ausente como "sem data" (cai na data do evento).
-- Sem tabelas novas → sem GRANTs novos. Idempotente.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Colunas
-- ────────────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS deposit_paid_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS second_paid_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fully_paid_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_from_status TEXT;

COMMENT ON COLUMN orders.deposit_paid_at IS
  'Momento em que o pagamento passou a >= 30% (1.ª parcela). Carimbado pelo trigger orders_stamp_payment_cancel; NULL = ainda não pagou ou encomenda antiga sem histórico (a receita cai na data do evento).';
COMMENT ON COLUMN orders.second_paid_at IS
  'Momento em que o pagamento passou a >= 70% (2.ª parcela). Ver deposit_paid_at.';
COMMENT ON COLUMN orders.fully_paid_at IS
  'Momento em que o pagamento passou a 100% (3.ª parcela). Ver deposit_paid_at.';
COMMENT ON COLUMN orders.cancelled_at IS
  'Momento em que o estado passou a cancelado (trigger). Limpo se a encomenda for reactivada.';
COMMENT ON COLUMN orders.cancelled_from_status IS
  'Estado em que a encomenda estava quando foi cancelada (trigger). NULL = cancelada sem histórico.';

-- ────────────────────────────────────────────────────────────
-- 2. Percentagem paga por payment_status (partilhada pelo trigger e pelo
--    backfill). Espelha paidRatio() em src/lib/finance.ts.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION payment_status_ratio(s TEXT)
RETURNS NUMERIC AS $$
  SELECT CASE s
    WHEN '100_pago' THEN 1
    WHEN '70_pago'  THEN 0.7
    WHEN '30_pago'  THEN 0.3
    ELSE 0
  END;
$$ LANGUAGE sql IMMUTABLE;

-- ────────────────────────────────────────────────────────────
-- 3. Trigger
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION orders_stamp_payment_cancel()
RETURNS TRIGGER AS $$
DECLARE
  r NUMERIC := payment_status_ratio(NEW.payment_status);
BEGIN
  -- Pagamentos: carimba os níveis atingidos (só se ainda sem data) e
  -- limpa os que ficaram acima do nível novo (recuo = correcção).
  IF TG_OP = 'INSERT' OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF r >= 0.3 AND NEW.deposit_paid_at IS NULL THEN NEW.deposit_paid_at := now(); END IF;
    IF r >= 0.7 AND NEW.second_paid_at  IS NULL THEN NEW.second_paid_at  := now(); END IF;
    IF r >= 1   AND NEW.fully_paid_at   IS NULL THEN NEW.fully_paid_at   := now(); END IF;
    IF r < 1   THEN NEW.fully_paid_at   := NULL; END IF;
    IF r < 0.7 THEN NEW.second_paid_at  := NULL; END IF;
    IF r < 0.3 THEN NEW.deposit_paid_at := NULL; END IF;
  END IF;

  -- Cancelamento: guarda quando e de que estado veio; reactivar limpa.
  IF NEW.status = 'cancelado'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'cancelado') THEN
    NEW.cancelled_at := now();
    NEW.cancelled_from_status := CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END;
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> 'cancelado' AND OLD.status = 'cancelado' THEN
    NEW.cancelled_at := NULL;
    NEW.cancelled_from_status := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_stamp_payment_cancel ON orders;
CREATE TRIGGER orders_stamp_payment_cancel
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION orders_stamp_payment_cancel();

-- ────────────────────────────────────────────────────────────
-- 4. Backfill a partir do audit_log
--    Para cada nível: a ÚLTIMA transição de "abaixo do nível" para
--    ">= nível". Só se o estado ACTUAL da encomenda ainda está nesse nível
--    (senão o carimbo pertence a um clique já revertido).
--    INSERT conta como transição de 0 para o estado inicial.
-- ────────────────────────────────────────────────────────────
WITH trans AS (
  SELECT
    record_id,
    changed_at,
    payment_status_ratio(COALESCE(old_values->>'payment_status', '100_por_pagar')) AS r_old,
    payment_status_ratio(new_values->>'payment_status')                             AS r_new
  FROM audit_log
  WHERE table_name = 'orders'
    AND action IN ('INSERT', 'UPDATE')
    AND new_values ? 'payment_status'
),
stamps AS (
  SELECT
    record_id,
    MAX(changed_at) FILTER (WHERE r_old < 0.3 AND r_new >= 0.3) AS deposit_at,
    MAX(changed_at) FILTER (WHERE r_old < 0.7 AND r_new >= 0.7) AS second_at,
    MAX(changed_at) FILTER (WHERE r_old < 1   AND r_new >= 1)   AS fully_at
  FROM trans
  GROUP BY record_id
)
UPDATE orders o
   SET deposit_paid_at = CASE WHEN payment_status_ratio(o.payment_status) >= 0.3 THEN COALESCE(o.deposit_paid_at, s.deposit_at) ELSE o.deposit_paid_at END,
       second_paid_at  = CASE WHEN payment_status_ratio(o.payment_status) >= 0.7 THEN COALESCE(o.second_paid_at,  s.second_at)  ELSE o.second_paid_at  END,
       fully_paid_at   = CASE WHEN payment_status_ratio(o.payment_status) >= 1   THEN COALESCE(o.fully_paid_at,   s.fully_at)   ELSE o.fully_paid_at   END
  FROM stamps s
 WHERE o.id = s.record_id;

-- Cancelamentos: a última transição para 'cancelado' e o estado de onde veio.
WITH cancels AS (
  SELECT DISTINCT ON (record_id)
    record_id,
    changed_at,
    old_values->>'status' AS from_status
  FROM audit_log
  WHERE table_name = 'orders'
    AND action = 'UPDATE'
    AND new_values->>'status' = 'cancelado'
    AND old_values->>'status' IS DISTINCT FROM 'cancelado'
  ORDER BY record_id, changed_at DESC
)
UPDATE orders o
   SET cancelled_at          = COALESCE(o.cancelled_at, c.changed_at),
       cancelled_from_status = COALESCE(o.cancelled_from_status, c.from_status)
  FROM cancels c
 WHERE o.id = c.record_id
   AND o.status = 'cancelado';

COMMIT;

-- ── Verificação (correr depois) ─────────────────────────────
-- 1. Quantas encomendas pagas ficaram com data e quantas sem (as sem
--    data caem na data do evento; esperado: só as importadas do Monday):
-- SELECT payment_status,
--        COUNT(*) FILTER (WHERE deposit_paid_at IS NOT NULL) AS com_data,
--        COUNT(*) FILTER (WHERE deposit_paid_at IS NULL)     AS sem_data
--   FROM orders
--  WHERE deleted_at IS NULL AND payment_status <> '100_por_pagar'
--  GROUP BY payment_status;
--
-- 2. Canceladas com a fase de origem:
-- SELECT cancelled_from_status, COUNT(*) FROM orders
--  WHERE status = 'cancelado' AND deleted_at IS NULL
--  GROUP BY 1 ORDER BY 2 DESC;
--
-- 3. Smoke do trigger: mudar o pagamento de uma encomenda de teste no
--    workbench e ver `deposit_paid_at` preenchido:
-- SELECT order_id, payment_status, deposit_paid_at, second_paid_at, fully_paid_at
--   FROM orders ORDER BY updated_at DESC LIMIT 5;
