-- ============================================================
-- Migration 114: Livro de pagamentos por encomenda (order_payments)
-- ============================================================
-- Contexto (sessão 178, 04/10/2026).
--
-- O PROBLEMA
-- `orders.payment_status` é um enum de PERCENTAGEM (4 degraus) e os euros
-- recebidos nunca foram guardados: tudo era derivado como
-- `budget × paidRatio()` (src/lib/finance.ts). Um campo só estava a
-- responder a duas perguntas diferentes, e por isso respondia mal às
-- duas:
--   1. em que ponto da cobrança estamos?
--   2. quanto dinheiro entrou de facto?
--
-- Três situações reais da Maria que não cabiam em lado nenhum:
--   (a) a cliente transfere uma quantia que não bate com nenhum marco
--       (devia 230,50€, não tinha os 50 cêntimos, ficaram para a parcela
--       seguinte);
--   (b) a encomenda cresce depois do sinal, ela pede o acerto até ao
--       marco do total novo, a cliente paga — e esse pagamento NÃO muda o
--       degrau do enum (era 70%, continua 70%), por isso entrava na conta
--       bancária sem deixar rasto nenhum na plataforma. Exemplo real:
--       241,50€ eram 70% de 345€; o quadro passou a 615€ e a cliente
--       pagou mais 189€ para fechar os 430,50€. Esses 189€ não existiam
--       em parte alguma;
--   (c) o momento de pedir a diferença é decisão dela, caso a caso (às
--       vezes na fase dos 40%, às vezes na última).
--
-- O DESENHO (decidido com ela)
-- Os dois eixos separam-se e deixam de se atrapalhar:
--   · `order_payments` = o dinheiro. Uma linha por pagamento recebido,
--     com valor e data. Fonte de verdade de tudo o que é euros.
--   · `orders.payment_status` = a FASE DA COBRANÇA, e continua a ser
--     escrita por ela como até aqui. Não é derivada do dinheiro, de
--     propósito: uma falta de 50 cêntimos não pode fazer uma encomenda
--     aparecer como se a parcela não tivesse sido paga, e o momento de
--     cobrar é dela.
--   · o que falta = orçamento − soma do livro. Sempre disponível, sem
--     depender de fases nem de percentagens.
--
-- Por isso esta migração NÃO deriva nem reescreve `payment_status`, e não
-- toca no trigger `orders_stamp_payment_cancel` (mig 111). Nada muda no
-- comportamento da app: só se acrescenta a tabela, a cache e o histórico.
--
-- O QUE FAZ
--   1. Tabela order_payments (euros + data + método). Permite valores
--      negativos (devoluções em cancelamentos).
--   2. orders.amount_paid — soma do livro, mantida por trigger, para
--      badges/filtros/"em falta" não precisarem de join.
--   3. Backfill a partir do audit_log (que guarda a linha inteira em cada
--      UPDATE desde a mig 001, logo tem o orçamento vigente em cada
--      pagamento). O que não é de confiança fica is_estimated = true,
--      para ela poder corrigir à mão.
--   4. anonymize_order passa a limpar note/invoice_url das linhas
--      (amount e paid_at FICAM — registo fiscal, retenção de 10 anos).
--
-- GRANTs explícitos (tabela nova, regra de 30/10/2026): authenticated com
-- CRUD (a RLS é que restringe: equipa lê, admin escreve) e service_role
-- tudo (backups/cron). RLS com is_team_member()/is_team_admin() (mig 085),
-- nunca emails hardcoded.
--
-- Ordem de deploy: correr ANTES do deploy (o tipo Order passa a declarar
-- amount_paid). Idempotente: o backfill é guardado por "esta encomenda
-- ainda não tem linhas", logo correr duas vezes não duplica nem pisa
-- correcções manuais.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Tabela + índices + RLS + GRANTs
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_payments (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount       NUMERIC(10,2) NOT NULL,
  paid_at      DATE NOT NULL,
  method       TEXT NOT NULL DEFAULT 'transferencia',
  voucher_code TEXT,
  is_estimated BOOLEAN NOT NULL DEFAULT false,
  note         TEXT,
  invoice_url  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   TEXT,
  CONSTRAINT order_payments_amount_nonzero CHECK (amount <> 0),
  CONSTRAINT order_payments_method_valid
    CHECK (method IN ('transferencia', 'mbway', 'dinheiro', 'vale', 'outro')),
  -- voucher_code só faz sentido em linhas de crédito de vale
  CONSTRAINT order_payments_voucher_only_on_vale
    CHECK (voucher_code IS NULL OR method = 'vale')
);

COMMENT ON TABLE order_payments IS
  'Livro de pagamentos: uma linha por pagamento realmente recebido numa encomenda. Fonte de verdade do dinheiro. NÃO determina orders.payment_status, que é a fase da cobrança e continua a ser decidida pela Maria.';
COMMENT ON COLUMN order_payments.amount IS
  'Euros recebidos nesta parcela. NEGATIVO = devolução ao cliente (reembolso de cancelamento). Nunca 0.';
COMMENT ON COLUMN order_payments.paid_at IS
  'Data em que o dinheiro entrou (não a data em que foi registado). Base da receita por período nas Finanças.';
COMMENT ON COLUMN order_payments.method IS
  'transferencia | mbway | dinheiro | vale | outro. ''vale'' = crédito de um vale-presente, não dinheiro novo.';
COMMENT ON COLUMN order_payments.voucher_code IS
  'Código do vale-presente creditado (só com method=''vale''). Índice único por encomenda impede creditar o mesmo vale duas vezes.';
COMMENT ON COLUMN order_payments.is_estimated IS
  'true = valor ou data reconstruídos do histórico, não confirmados pela Maria. Mostrado na UI com um aviso; passa a false quando ela corrige a linha.';

CREATE INDEX IF NOT EXISTS order_payments_order_idx
  ON order_payments(order_id, paid_at);

-- Receita por período varre por data em todas as encomendas.
CREATE INDEX IF NOT EXISTS order_payments_paid_at_idx
  ON order_payments(paid_at);

-- O mesmo vale não pode ser creditado duas vezes na mesma encomenda.
CREATE UNIQUE INDEX IF NOT EXISTS order_payments_voucher_once_idx
  ON order_payments(order_id, voucher_code)
  WHERE method = 'vale';

DROP TRIGGER IF EXISTS order_payments_updated_at ON order_payments;
CREATE TRIGGER order_payments_updated_at
  BEFORE UPDATE ON order_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

-- Toda a equipa lê (a Ana vê as Finanças em modo leitura).
DROP POLICY IF EXISTS "order_payments_member_read" ON order_payments;
CREATE POLICY "order_payments_member_read" ON order_payments
  FOR SELECT USING (is_team_member(auth.jwt() ->> 'email'));

-- Só admin escreve.
DROP POLICY IF EXISTS "order_payments_admin_write" ON order_payments;
CREATE POLICY "order_payments_admin_write" ON order_payments
  FOR ALL USING (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

-- SELECT é obrigatório mesmo para quem só insere: INSERT ... RETURNING
-- precisa dele (armadilha das migs 062/065/068/081).
GRANT SELECT, INSERT, UPDATE, DELETE ON order_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON order_payments TO service_role;

-- ────────────────────────────────────────────────────────────
-- 2. Cache da soma em orders
-- ────────────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN orders.amount_paid IS
  'Soma do livro order_payments (entradas menos devoluções), mantida por trigger. DERIVADO: nunca escrever à mão. Use-o para "entrou algum dinheiro?" e para "em falta = budget - amount_paid", em vez do degrau de payment_status (que é a fase da cobrança, não o dinheiro).';

-- ────────────────────────────────────────────────────────────
-- 3. Manutenção da cache
--    Só mexe em amount_paid. NÃO toca em payment_status nem nos carimbos
--    de data: a fase da cobrança é decisão da Maria e os carimbos da mig
--    111 continuam a marcar quando ela a fez avançar.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION order_recalc_amount_paid(p_order_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE orders o
     SET amount_paid = COALESCE(
           (SELECT SUM(amount) FROM order_payments WHERE order_id = p_order_id), 0)
   WHERE o.id = p_order_id
     AND o.amount_paid IS DISTINCT FROM COALESCE(
           (SELECT SUM(amount) FROM order_payments WHERE order_id = p_order_id), 0);
$$ LANGUAGE sql;

COMMENT ON FUNCTION order_recalc_amount_paid(UUID) IS
  'Põe orders.amount_paid igual à soma do livro. Chamada pelo trigger order_payments_sync; não altera mais nada na encomenda.';

-- ────────────────────────────────────────────────────────────
-- 4. BACKFILL
--    Corre antes de o trigger existir, de propósito: assim não há um
--    UPDATE a orders por cada linha inserida.
-- ────────────────────────────────────────────────────────────

-- 4.1 Transições de pagamento registadas no audit_log.
--     O audit grava to_jsonb(NEW) inteiro, logo traz o orçamento da
--     altura. O cast é defensivo: um valor inesperado no JSON não pode
--     fazer explodir a migração toda.
CREATE TEMP TABLE _pay_trans ON COMMIT DROP AS
SELECT
  a.record_id,
  a.changed_at,
  payment_status_ratio(COALESCE(a.old_values->>'payment_status', '100_por_pagar')) AS r_old,
  payment_status_ratio(a.new_values->>'payment_status')                            AS r_new,
  CASE WHEN a.new_values->>'budget' ~ '^-?[0-9]+(\.[0-9]+)?$'
       THEN (a.new_values->>'budget')::numeric END                                 AS budget_then
FROM audit_log a
WHERE a.table_name = 'orders'
  AND a.action IN ('INSERT', 'UPDATE')
  AND a.new_values ? 'payment_status'
  AND EXISTS (SELECT 1 FROM orders o WHERE o.id = a.record_id);

CREATE INDEX ON _pay_trans(record_id);

-- 4.1b Subidas de orçamento. É quando ela pede o acerto à cliente, e o
--      dinheiro entra por essa altura. Como esse pagamento não muda o
--      degrau do enum, não deixa rasto no histórico de pagamentos — a
--      data da subida do orçamento é a melhor pista que existe.
CREATE TEMP TABLE _budget_raises ON COMMIT DROP AS
SELECT a.record_id, max(a.changed_at) AS raised_at
  FROM audit_log a
 WHERE a.table_name = 'orders'
   AND a.action = 'UPDATE'
   AND a.new_values->>'budget' ~ '^-?[0-9]+(\.[0-9]+)?$'
   AND a.old_values->>'budget' ~ '^-?[0-9]+(\.[0-9]+)?$'
   AND (a.new_values->>'budget')::numeric > (a.old_values->>'budget')::numeric
 GROUP BY a.record_id;

CREATE INDEX ON _budget_raises(record_id);

-- 4.2 Uma linha por DIA em que entrou dinheiro.
--     Para cada marco (30% / 70% / 100%) que a fase ACTUAL justifica,
--     procura-se a ÚLTIMA vez que o pagamento subiu de baixo desse marco
--     para ele — a mesma lógica dos carimbos da mig 111, que assim ignora
--     cliques errados já revertidos.
--
--     O VALOR DE CADA PARCELA segue a regra que a Maria usa de facto
--     (confirmada nas mensagens dela a duas clientes, 04/10/2026): em
--     cada fase cobra-se **o marco acumulado do total vigente NESSE DIA,
--     menos tudo o que já tinha entrado**. Não é uma fatia fixa de
--     30/40/30 do orçamento de cada momento.
--       Exemplo real: 1ª parcela 30% de 300€ = 90€; depois o quadro
--       passou a 500€ e a 2ª parcela foi 70% de 500€ − 90€ = 260€, e não
--       40% de 500€ = 200€. Total 350€, que é o que a fase "70%" diz.
--     Daí o LAG(): a parcela é a diferença entre o devido acumulado neste
--     marco e o devido acumulado no marco anterior.
--
--     O GROUP BY pela data funde parcelas que vieram da mesma transição
--     (um salto de 0 para 70% alimenta os marcos de 30% e de 70%, mas foi
--     uma transferência só), para o livro se parecer com o extracto
--     bancário em vez de inventar duas entradas no mesmo dia.
INSERT INTO order_payments (order_id, amount, paid_at, method, is_estimated, note)
SELECT p.oid,
       round(SUM(p.amount), 2),
       p.changed_at::date,
       CASE WHEN p.cash_on_delivery THEN 'dinheiro' ELSE 'transferencia' END,
       false,
       'Reconstruído do histórico (mig 114)'
  FROM (
    SELECT m.oid,
           m.changed_at,
           m.cash_on_delivery,
           m.devido - COALESCE(
             LAG(m.devido) OVER (PARTITION BY m.oid ORDER BY m.nivel), 0
           ) AS amount
      FROM (
        SELECT o.id AS oid,
               n.nivel,
               t.changed_at,
               o.cash_on_delivery,
               round(n.nivel * t.budget_then, 2) AS devido
          FROM orders o
          CROSS JOIN (VALUES (0.3::numeric), (0.7), (1.0)) AS n(nivel)
          JOIN LATERAL (
            SELECT t2.budget_then, t2.changed_at
              FROM _pay_trans t2
             WHERE t2.record_id = o.id
               AND t2.r_old < n.nivel
               AND t2.r_new >= n.nivel
               AND t2.budget_then IS NOT NULL
             ORDER BY t2.changed_at DESC
             LIMIT 1
          ) t ON true
         WHERE n.nivel <= payment_status_ratio(o.payment_status)
           AND NOT EXISTS (SELECT 1 FROM order_payments pp WHERE pp.order_id = o.id)
      ) m
  ) p
 -- Uma parcela <= 0 significa que o orçamento DESCEU entre marcos (houve
 -- desconto depois de pagar). Não é um reembolso: ignora-se aqui e o
 -- acerto do passo 4.5 resolve o total.
 WHERE p.amount > 0
 GROUP BY p.oid, p.changed_at::date, p.cash_on_delivery
HAVING round(SUM(p.amount), 2) > 0;

-- 4.3 Encomendas cujo pagamento recuou alguma vez: recuar e voltar a
--     subir é correcção de um clique errado, não dois pagamentos, por
--     isso nenhuma linha dessa encomenda é de confiança.
UPDATE order_payments p
   SET is_estimated = true
 WHERE p.note = 'Reconstruído do histórico (mig 114)'
   AND EXISTS (
     SELECT 1 FROM _pay_trans t
      WHERE t.record_id = p.order_id AND t.r_new < t.r_old
   );

-- 4.4 Encomendas pagas sem histórico utilizável (importadas do Monday —
--     a mig 112 anulou-lhes os carimbos). Uma linha só, estimada.
--     budget_at_first_payment é o melhor dado que existe para a 1.ª
--     parcela quando difere do orçamento actual.
INSERT INTO order_payments (order_id, amount, paid_at, method, is_estimated, note)
SELECT o.id,
       round(payment_status_ratio(o.payment_status) * COALESCE(o.budget_at_first_payment, o.budget), 2),
       COALESCE(o.deposit_paid_at::date, o.event_date, o.created_at::date),
       CASE WHEN o.cash_on_delivery THEN 'dinheiro' ELSE 'outro' END,
       true,
       'Sem histórico no audit log: valor e data estimados (mig 114)'
  FROM orders o
 WHERE payment_status_ratio(o.payment_status) > 0
   AND COALESCE(o.budget_at_first_payment, o.budget) IS NOT NULL
   AND round(payment_status_ratio(o.payment_status) * COALESCE(o.budget_at_first_payment, o.budget), 2) <> 0
   AND NOT EXISTS (SELECT 1 FROM order_payments p WHERE p.order_id = o.id);

-- 4.5 O ACERTO QUE NUNCA TEVE ONDE SER REGISTADO.
--     Quando o orçamento sobe, ela pede à cliente a diferença até ao
--     marco do total novo, e a cliente paga. Mas esse pagamento não muda
--     o degrau do enum, por isso nunca deixou rasto: não tem data, não
--     aparece em parte alguma, e a conta era feita de cabeça em cada
--     mensagem.
--       Exemplo real (04/10/2026): 241,50€ eram 70% de 345€; o quadro
--       passou a 615€ e a cliente pagou mais 189€, ficando em 430,50€
--       = 70% de 615€. Os 189€ existem na conta bancária e não existiam
--       em lado nenhum na plataforma.
--     Logo esta linha NÃO inventa euros: recupera os que faltavam. A fase
--     actual é a prova de que entraram, porque a Maria só a faz avançar
--     depois de a cliente pagar.
--     Data, por ordem de fiabilidade: a última subida do orçamento (é
--     quando o acerto é pedido e pago), o carimbo do nível actual, a data
--     do evento, a data do pedido. Sempre is_estimated.
--
--     Diferença NEGATIVA (a cliente pagou mais do que o total actual
--     pede, porque houve desconto depois do pagamento) não gera linha: o
--     dinheiro entrou mesmo e não se apaga.
INSERT INTO order_payments (order_id, amount, paid_at, method, is_estimated, note)
SELECT o.id,
       round(payment_status_ratio(o.payment_status) * o.budget - s.pago, 2),
       COALESCE(
         b.raised_at::date,
         CASE payment_status_ratio(o.payment_status)
           WHEN 1   THEN o.fully_paid_at::date
           WHEN 0.7 THEN o.second_paid_at::date
           ELSE          o.deposit_paid_at::date
         END,
         o.event_date,
         o.created_at::date
       ),
       CASE WHEN o.cash_on_delivery THEN 'dinheiro' ELSE 'transferencia' END,
       true,
       'Acerto por subida do orçamento, sem registo próprio (mig 114)'
  FROM orders o
  JOIN (
    SELECT order_id, SUM(amount) AS pago FROM order_payments GROUP BY order_id
  ) s ON s.order_id = o.id
  LEFT JOIN _budget_raises b ON b.record_id = o.id
 WHERE o.budget IS NOT NULL
   AND round(payment_status_ratio(o.payment_status) * o.budget - s.pago, 2) > 0;

-- 4.6 Preencher a cache de uma vez (mais barato que um UPDATE por linha).
UPDATE orders o
   SET amount_paid = COALESCE(s.pago, 0)
  FROM (
    SELECT order_id, SUM(amount) AS pago FROM order_payments GROUP BY order_id
  ) s
 WHERE o.id = s.order_id
   AND o.amount_paid IS DISTINCT FROM COALESCE(s.pago, 0);

-- ────────────────────────────────────────────────────────────
-- 5. Trigger de sincronização (criado DEPOIS do backfill)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION order_payments_sync()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM order_recalc_amount_paid(OLD.order_id);
    RETURN OLD;
  END IF;
  PERFORM order_recalc_amount_paid(NEW.order_id);
  IF TG_OP = 'UPDATE' AND NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    PERFORM order_recalc_amount_paid(OLD.order_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_payments_sync ON order_payments;
CREATE TRIGGER order_payments_sync
  AFTER INSERT OR UPDATE OR DELETE ON order_payments
  FOR EACH ROW EXECUTE FUNCTION order_payments_sync();

-- ────────────────────────────────────────────────────────────
-- 6. RGPD — anonimização apanha as linhas filhas
--    A função da mig 024/060 só fazia UPDATE em orders. amount e paid_at
--    FICAM (registo financeiro, retenção fiscal de 10 anos); só se limpa
--    o que pode ter texto livre ou link para a Drive do cliente.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION anonymize_order(p_order_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE orders SET
    client_name         = '[anonimizado]',
    email               = NULL,
    phone               = NULL,
    couple_names        = NULL,
    event_location      = NULL,
    additional_notes    = NULL,
    nif                 = NULL,
    invoice_url_sinal      = NULL,
    invoice_url_intermedio = NULL,
    invoice_url_final      = NULL,
    drive_folder_url    = NULL,
    drive_folder_id     = NULL,
    flowers_photo_url   = NULL,
    inspiration_gallery = '[]'::jsonb,
    pickup_address      = NULL,
    sticky_note         = NULL,
    public_status_message_pt = NULL,
    public_status_message_en = NULL,
    consent_ip          = NULL,
    anonymized_at       = now()
  WHERE id = p_order_id
    AND anonymized_at IS NULL;

  -- Linhas do livro: só nota e factura (o dinheiro em si tem de ficar).
  UPDATE order_payments SET
    note        = NULL,
    invoice_url = NULL
  WHERE order_id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- ── Verificação (correr depois) ─────────────────────────────
-- 1. O QUE FALTA RECEBER, por encomenda. É a conta que até aqui era
--    feita de cabeça. Esperado: perto de 0 na maioria, e os casos com
--    valor são os que têm mesmo dinheiro por entrar:
-- SELECT o.client_name, o.order_id, o.payment_status AS fase,
--        o.budget AS orcamento, o.amount_paid AS entrou,
--        round(o.budget - o.amount_paid, 2) AS falta_ao_todo
--   FROM orders o
--  WHERE o.deleted_at IS NULL AND o.budget IS NOT NULL
--    AND o.status <> 'cancelado'
--    AND round(o.budget - o.amount_paid, 2) <> 0
--  ORDER BY falta_ao_todo DESC;
--
-- 2. OS ACERTOS RECUPERADOS — pagamentos que entraram por subida de
--    orçamento e que até aqui não existiam em lado nenhum. Confirmar que
--    os valores são os esperados (ex.: os 189€ da encomenda da Isabelle):
-- SELECT o.client_name, o.order_id, o.budget, p.amount, p.paid_at
--   FROM order_payments p JOIN orders o ON o.id = p.order_id
--  WHERE p.note = 'Acerto por subida do orçamento, sem registo próprio (mig 114)'
--  ORDER BY p.amount DESC;
--
-- 2b. Uma encomenda em concreto, parcela a parcela:
-- SELECT p.paid_at, p.amount, p.method, p.is_estimated, p.note
--   FROM order_payments p JOIN orders o ON o.id = p.order_id
--  WHERE o.order_id = '9MDV31XZSHJILMTJ'
--  ORDER BY p.paid_at;
--
-- 3. Quanto do livro é de confiança:
-- SELECT is_estimated, COUNT(*) AS linhas, COUNT(DISTINCT order_id) AS encomendas,
--        round(SUM(amount), 2) AS euros
--   FROM order_payments GROUP BY is_estimated;
--
-- 4. Nenhuma encomenda com fase paga pode ficar sem linhas (dá 0):
-- SELECT COUNT(*) FROM orders o
--  WHERE o.deleted_at IS NULL
--    AND payment_status_ratio(o.payment_status) > 0
--    AND NOT EXISTS (SELECT 1 FROM order_payments p WHERE p.order_id = o.id);
--
-- 5. Smoke do trigger: inserir e apagar um pagamento de teste e ver
--    amount_paid mexer sozinho (substituir o UUID):
-- INSERT INTO order_payments(order_id, amount, paid_at)
--   VALUES ('<uuid da encomenda>', 50, CURRENT_DATE);
-- SELECT budget, amount_paid, payment_status FROM orders WHERE id = '<uuid>';
-- DELETE FROM order_payments WHERE order_id = '<uuid>' AND amount = 50;
