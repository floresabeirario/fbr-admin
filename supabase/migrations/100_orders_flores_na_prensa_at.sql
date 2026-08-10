-- ============================================================
-- 100 — Timestamp de entrada em "Flores na prensa" (janela do desidratador)
-- ============================================================
-- O sinal "no desidratador" (mig 099) só faz sentido no ~1º mês após as
-- flores entrarem na prensa — depois disso já estão secas e fora do
-- desidratador. Para o admin poder esconder o botão passado esse mês,
-- precisamos de saber QUANDO a encomenda entrou em "flores_na_prensa".
--
-- Aproveitamos o trigger que já existe (mig 005, sync_public_status_fields),
-- que já detecta exactamente essa transição para gerar a data prevista de
-- entrega (+6 meses). Acrescentamos o carimbo `flores_na_prensa_at`.
--
-- BACKFILL: encomendas que já passaram pela prensa têm
-- estimated_delivery_date = (data de entrada na prensa + 6 meses), gerado
-- pelo mesmo trigger. Recuperamos a data de entrada subtraindo 6 meses —
-- aproximação boa o suficiente para a janela de 1 mês das encomendas em
-- curso. Encomendas nunca postas na prensa ficam a NULL (sem botão).
--
-- GRANTS: coluna nova em `orders` (tabela anterior a 30/10/2026, grants
-- table-level) — herda os privilégios existentes; nada a fazer.
--
-- ROLLOUT: correr no SQL Editor antes (ou junto) do deploy do admin.
-- ============================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS flores_na_prensa_at timestamptz;

COMMENT ON COLUMN orders.flores_na_prensa_at IS
  'Momento em que a encomenda entrou em "flores_na_prensa" (carimbado pelo trigger sync_public_status_fields). Usado para a janela de 1 mês do sinal "no desidratador".';

-- Recriar a função do trigger (mig 005) com a linha extra do carimbo.
-- Idêntica à original, só acrescenta o SET de flores_na_prensa_at na
-- mesma condição de transição para "flores_na_prensa".
CREATE OR REPLACE FUNCTION sync_public_status_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Em INSERT: se o admin não explicitou um idioma para o status
  -- público, copia o idioma do formulário (default: 'pt').
  IF TG_OP = 'INSERT' AND NEW.public_status_language IS NULL THEN
    NEW.public_status_language := COALESCE(NEW.form_language, 'pt');
  END IF;

  -- Transição para "flores_na_prensa" (1ª vez): gera a data prevista de
  -- entrega (+6 meses) se ainda não houver, e carimba o momento de entrada.
  IF NEW.status = 'flores_na_prensa'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'flores_na_prensa') THEN
    IF NEW.estimated_delivery_date IS NULL THEN
      NEW.estimated_delivery_date := (CURRENT_DATE + INTERVAL '6 months')::date;
    END IF;
    IF NEW.flores_na_prensa_at IS NULL THEN
      NEW.flores_na_prensa_at := now();
    END IF;
  END IF;

  -- Sempre que algo público muda, actualizar o timestamp.
  IF TG_OP = 'INSERT' THEN
    NEW.public_status_updated_at := now();
  ELSIF TG_OP = 'UPDATE' AND (
       NEW.status                   IS DISTINCT FROM OLD.status
    OR NEW.public_status_message_pt IS DISTINCT FROM OLD.public_status_message_pt
    OR NEW.public_status_message_en IS DISTINCT FROM OLD.public_status_message_en
    OR NEW.estimated_delivery_date  IS DISTINCT FROM OLD.estimated_delivery_date
    OR NEW.public_status_language   IS DISTINCT FROM OLD.public_status_language
  ) THEN
    NEW.public_status_updated_at := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (O trigger orders_sync_public_status já aponta para esta função — o
--  CREATE OR REPLACE actualiza-a sem precisar de recriar o trigger.)

-- Backfill: recupera a data de entrada na prensa das encomendas que já
-- lá passaram, a partir da data prevista de entrega (+6 meses atrás).
UPDATE orders
SET flores_na_prensa_at = (estimated_delivery_date::timestamptz - INTERVAL '6 months')
WHERE flores_na_prensa_at IS NULL
  AND estimated_delivery_date IS NOT NULL;

COMMIT;

-- ── Verificação (correr depois, no SQL Editor) ──────────────
-- SELECT order_id, status, estimated_delivery_date, flores_na_prensa_at
-- FROM orders
-- WHERE flores_na_prensa_at IS NOT NULL
-- ORDER BY flores_na_prensa_at DESC
-- LIMIT 20;
