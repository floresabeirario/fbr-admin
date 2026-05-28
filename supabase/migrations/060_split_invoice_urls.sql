-- ============================================================
-- Migration 060: 3 anexos de fatura por encomenda + actualizar
-- funções RGPD e policy de insert público.
-- ============================================================
-- Contexto (sessão 93, fase 6):
-- A Maria reportou que cada pagamento (sinal 30%, intermédio 40%,
-- final 30% — ou variações 70%/30%, 100% à cabeça, etc.) gera uma
-- fatura distinta. Até agora `orders.invoice_attachment_url`
-- guardava apenas 1 link, perdendo o histórico dos outros 2.
--
-- Esta migração separa o campo em 3 colunas:
--   • invoice_url_sinal       (substitui invoice_attachment_url)
--   • invoice_url_intermedio  (novo)
--   • invoice_url_final       (novo)
--
-- Cada uma é apenas um URL para a Drive — os PDFs continuam fora
-- da BD. Vouchers ficam com `invoice_attachment_url` (1 só fatura).
--
-- A criação automática de tarefa "Enviar fatura …" é tratada em
-- `updateOrderAction` (servidor), não por trigger SQL — facilita
-- escrever o autor da tarefa, ligar ao order_id, etc.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Renomear + criar
-- ────────────────────────────────────────────────────────────
ALTER TABLE orders RENAME COLUMN invoice_attachment_url TO invoice_url_sinal;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_url_intermedio TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_url_final      TEXT;

COMMENT ON COLUMN orders.invoice_url_sinal      IS 'URL Drive da fatura do 1º pagamento (sinal). Renomeado de invoice_attachment_url na mig 060.';
COMMENT ON COLUMN orders.invoice_url_intermedio IS 'URL Drive da fatura do 2º pagamento (intermédio — só usado em esquemas 30/40/30).';
COMMENT ON COLUMN orders.invoice_url_final      IS 'URL Drive da fatura do pagamento final (30% ou 100% à cabeça).';

-- ────────────────────────────────────────────────────────────
-- 2. Actualizar anonymize_order (mig 024) — limpar os 3 campos
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────
-- 3. Actualizar policy do insert público (mig 016)
-- ────────────────────────────────────────────────────────────
-- O form público continua a só conseguir criar encomendas sem
-- qualquer fatura preenchida (admin é que anexa depois).
DROP POLICY IF EXISTS "orders_public_insert" ON orders;
CREATE POLICY "orders_public_insert" ON orders
  FOR INSERT
  TO anon
  WITH CHECK (
    consent_at IS NOT NULL
    AND deleted_at IS NULL
    AND status         = 'entrega_flores_agendar'
    AND payment_status = '100_por_pagar'
    AND contacted      = false
    AND manually_no_response = false
    AND budget         IS NULL
    AND partner_id     IS NULL
    AND coupon_code    IS NULL
    AND nif            IS NULL
    AND invoice_url_sinal      IS NULL
    AND invoice_url_intermedio IS NULL
    AND invoice_url_final      IS NULL
    AND drive_folder_url IS NULL
    AND flowers_photo_url IS NULL
  );

COMMIT;

-- ============================================================
-- Verificações rápidas:
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='orders'
--      AND column_name LIKE 'invoice_url_%';
--   -- 3 linhas: invoice_url_sinal, invoice_url_intermedio, invoice_url_final
--
--   SELECT count(*) FROM orders
--    WHERE invoice_url_sinal IS NOT NULL;
--   -- contagem das encomendas que tinham fatura anexada antes
--
--   SELECT pg_get_functiondef('anonymize_order(uuid)'::regprocedure);
--   -- deve referir invoice_url_sinal/intermedio/final
-- ============================================================
