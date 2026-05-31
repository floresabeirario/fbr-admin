-- ============================================================
-- Migration 065: GRANTs para service_role em tabelas de background
-- ============================================================
-- Mesmo padrao da mig 062: tabelas tocadas por createAdminClient
-- (webhooks, cron jobs, after-tasks) precisam de GRANT explicito a
-- service_role, mesmo que esta role bypasse RLS.
--
-- Sintomas observados:
--  - mig 062: whatsapp_conversations/messages (resolvido)
--  - agora: google_integration (lida pelo job media fetch após o
--    webhook do WhatsApp para fazer upload na Drive)
--  - system_settings: o cron healthcheck tenta upsertar — incluido
--    aqui preventivamente para evitar mesmo problema
-- ============================================================

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON google_integration TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON system_settings    TO service_role;

COMMIT;
