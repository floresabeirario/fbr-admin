-- ============================================================
-- FBR Admin — Fase 5 (parte 2): Formulários públicos
-- Permite que o site floresabeirario.pt insira directamente em
-- `orders` (form de Reserva) e `vouchers` (form de Vale-Presente)
-- usando o role `anon` (chave pública), sem expor credenciais.
--
-- Garantias de segurança:
--   1) `anon` só pode INSERT (nunca SELECT/UPDATE/DELETE em orders).
--   2) Cada INSERT TEM de trazer o consentimento RGPD preenchido.
--   3) Estados administrativos (status, payment_status, partner_id,
--      etc.) são forçados aos valores iniciais — o cliente não os
--      pode escolher mesmo que tente.
--   4) Mantém-se o GRANT EXECUTE em generate_order_id() e
--      generate_voucher_code() ao role anon (já existia em 003 e 009).
--
-- Executar no Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ── 1. Campos de consentimento RGPD (idempotente) ───────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS consent_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS consent_ip      TEXT;

ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS consent_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS consent_ip      TEXT;

-- Comentários úteis em produção (Supabase Dashboard mostra-os)
COMMENT ON COLUMN orders.consent_at      IS 'Timestamp do consentimento RGPD (checkbox de Termos e Condições do form público).';
COMMENT ON COLUMN orders.consent_version IS 'Versão da política/T&C aceite (ex.: "1.0-explicit").';
COMMENT ON COLUMN orders.consent_ip      IS 'IP de origem do submit (apenas para auditoria RGPD).';

COMMENT ON COLUMN vouchers.consent_at      IS 'Timestamp do consentimento RGPD do submit do form de vale-presente.';
COMMENT ON COLUMN vouchers.consent_version IS 'Versão da política/T&C aceite. Pode ser "1.0-implicit" enquanto não houver checkbox dedicada no form de vales.';
COMMENT ON COLUMN vouchers.consent_ip      IS 'IP de origem do submit (auditoria RGPD).';

-- ── 2. GRANT INSERT a anon (sem isto a policy não chega) ────────
GRANT INSERT ON orders   TO anon;
GRANT INSERT ON vouchers TO anon;

-- O trigger de audit log faz INSERT em audit_log; o anon precisa do GRANT.
GRANT INSERT ON audit_log TO anon;

-- generate_order_id() já tinha sido concedida ao anon em 003.
-- generate_voucher_code() ainda não:
GRANT EXECUTE ON FUNCTION generate_voucher_code() TO anon;
GRANT EXECUTE ON FUNCTION update_updated_at()      TO anon;

-- ── 3. Policies de INSERT para anon ─────────────────────────────
-- Cada INSERT TEM de trazer consent_at preenchido. Os campos
-- administrativos são bloqueados aos valores iniciais para impedir
-- que um cliente malicioso force a sua encomenda para "Quadro
-- recebido" ou "100% pago" via API pública.

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
    AND invoice_attachment_url IS NULL
    AND drive_folder_url IS NULL
    AND flowers_photo_url IS NULL
  );

DROP POLICY IF EXISTS "vouchers_public_insert" ON vouchers;
CREATE POLICY "vouchers_public_insert" ON vouchers
  FOR INSERT
  TO anon
  WITH CHECK (
    consent_at IS NOT NULL
    AND deleted_at IS NULL
    AND payment_status = '100_por_pagar'
    AND send_status    = 'nao_agendado'
    AND usage_status   = 'preservacao_nao_agendada'
    AND nif            IS NULL
    AND invoice_attachment_url IS NULL
  );

-- ── 4. Verificação rápida (opcional, comentada) ─────────────────
-- SELECT polname, polcmd, polroles::regrole[]
--   FROM pg_policy
--   WHERE polrelid IN ('orders'::regclass, 'vouchers'::regclass)
--   ORDER BY polrelid, polname;
