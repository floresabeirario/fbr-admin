-- ============================================================
-- FBR Admin — Vale-Presente: permissões + campos do PDF spec
-- Executar no Supabase SQL Editor
-- ============================================================

-- 1) GRANTS em falta (causa do "erro 500" ao criar vale)
--    A migração 009 só fez GRANT EXECUTE em generate_voucher_code(),
--    deixando o role `authenticated` sem permissões na tabela.
GRANT SELECT, INSERT, UPDATE, DELETE ON vouchers TO authenticated;
GRANT EXECUTE ON FUNCTION generate_voucher_code() TO authenticated;

-- 2) Garantir que update_updated_at() está acessível (usada pelo trigger)
GRANT EXECUTE ON FUNCTION update_updated_at() TO authenticated;

-- 3) Campos em falta segundo o PDF
--    - recipient_contact: email/WhatsApp do destinatário (quando entrega digital direta)
--    - recipient_address: morada para envio (quando entrega física direta ao destinatário)
--    - ideal_send_date:   data ideal para envio do vale (opcional, quando vai para o destinatário)
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS recipient_contact TEXT,
  ADD COLUMN IF NOT EXISTS recipient_address TEXT,
  ADD COLUMN IF NOT EXISTS ideal_send_date   DATE;
