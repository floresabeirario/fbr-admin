-- ============================================================
-- Migration 062: GRANTs para service_role nas tabelas WhatsApp
-- ============================================================
-- A mig 061 fez GRANT ... TO authenticated mas esqueceu service_role.
-- O webhook /api/whatsapp/webhook usa createAdminClient (service role)
-- para bypassar RLS — mas service_role ainda precisa de privilegios
-- explicitos a nivel de tabela (PostgreSQL grant != RLS).
--
-- Sintoma observado: erro 42501 "permission denied for table
-- whatsapp_conversations" ao tentar inserir mensagem real da Meta.
--
-- Padrao a manter para futuras tabelas tocadas por webhooks/cron:
-- GRANT a authenticated + service_role.
-- ============================================================

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON whatsapp_messages      TO service_role;

GRANT EXECUTE ON FUNCTION mark_whatsapp_conversation_read(UUID) TO service_role;

COMMIT;
