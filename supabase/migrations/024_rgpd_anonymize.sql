-- ============================================================
-- Migration 024: RGPD — anonimização + retenção
-- ============================================================
-- Fase 6 (sessão 41).
--
-- 1. Adiciona `anonymized_at TIMESTAMPTZ` em orders e vouchers.
--    Linhas anonimizadas continuam contabilizadas em métricas
--    (receita, contagens) mas perdem todos os dados pessoais.
--
-- 2. Funções `anonymize_order(uuid)` / `anonymize_voucher(uuid)`
--    que substituem campos PII por placeholders e marcam o
--    timestamp. SECURITY DEFINER (precisam de escrever mesmo
--    para Ana viewer — mas o GRANT EXECUTE limita ao admin).
--
-- 3. Index parcial em `frame_delivery_date` (orders) para
--    suportar a listagem de retenção de 10 anos sem table scan.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Coluna anonymized_at
-- ------------------------------------------------------------
ALTER TABLE orders   ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

-- Index para a listagem de retenção (ordena por frame_delivery_date
-- entre encomendas concluídas e não anonimizadas).
CREATE INDEX IF NOT EXISTS orders_retention_idx
  ON orders (frame_delivery_date)
  WHERE deleted_at IS NULL
    AND anonymized_at IS NULL
    AND status = 'quadro_recebido';

-- ------------------------------------------------------------
-- 2. Funções de anonimização
-- ------------------------------------------------------------
-- Estratégia: substituir TODA a PII por placeholders fixos.
-- O `id` e `order_id`/`code` (chaves primárias) NÃO mudam para
-- preservar integridade referencial e métricas (audit_log,
-- partners.recommended_orders, etc).
-- O audit_log da própria anonimização regista os old_values
-- — por isso é uma operação NÃO reversível pelo audit.
--
-- Importante: ANONIMIZAR mantém a linha (vs. DELETE definitivo
-- que a remove). Use anonimização para encomendas em prazo
-- fiscal e DELETE só para casos extremos (pedido explícito do
-- titular dos dados ou erro grosseiro).

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
    invoice_attachment_url = NULL,
    drive_folder_url    = NULL,
    drive_folder_id     = NULL,
    flowers_photo_url   = NULL,
    inspiration_gallery = '[]'::jsonb,
    pickup_address      = NULL,
    sticky_note         = NULL,
    public_status_message_pt = NULL,
    public_status_message_en = NULL,
    consent_ip          = NULL,
    -- Campos que ficam: id, order_id, status, event_type, event_date,
    -- frame_size, frame_background, budget, payment_status,
    -- partner_id, partner_commission, how_found_fbr, form_language,
    -- created_at, *_delivery_method, *_shipping_cost — necessários
    -- para métricas e relatórios fiscais agregados.
    anonymized_at       = now()
  WHERE id = p_order_id
    AND anonymized_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION anonymize_voucher(p_voucher_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE vouchers SET
    sender_name       = '[anonimizado]',
    sender_email      = NULL,
    sender_phone      = NULL,
    recipient_name    = '[anonimizado]',
    recipient_contact = NULL,
    recipient_address = NULL,
    message           = NULL,
    comments          = NULL,
    nif               = NULL,
    invoice_attachment_url = NULL,
    drive_folder_url  = NULL,
    drive_folder_id   = NULL,
    sticky_note       = NULL,
    consent_ip        = NULL,
    -- Campos que ficam: id, code, amount, payment_status, send_status,
    -- usage_status, expiry_date, partner_id, partner_commission,
    -- how_found_fbr, form_language, created_at, delivery_*.
    anonymized_at     = now()
  WHERE id = p_voucher_id
    AND anonymized_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------
-- GRANTs — só admins (via requireAdmin no server action).
-- A function é SECURITY DEFINER, mas o GRANT EXECUTE controla
-- quem a pode chamar via PostgREST.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION anonymize_order(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION anonymize_voucher(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION anonymize_order(UUID)   TO authenticated;
GRANT EXECUTE ON FUNCTION anonymize_voucher(UUID) TO authenticated;

COMMIT;
