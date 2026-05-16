-- ============================================================
-- Migration 042: Registo manual de conversas WhatsApp
-- ============================================================
-- Fase B do plano de comunicações (sessão 64+).
-- Sem API oficial do WhatsApp, registamos conversas manualmente:
--   - Maria cola texto/screenshots de conversas no workbench
--   - Cada entrada tem: timestamp, direcção (enviada/recebida), conteúdo,
--     URLs opcionais de screenshots (sempre Drive — [[feedback_drive_para_ficheiros]])
--
-- Estrutura: JSONB array em `orders.whatsapp_log` (mesmo padrão que
-- `inspiration_gallery`). Cada entrada:
--   {
--     "id": "uuid-v4",
--     "timestamp": "2026-05-16T14:32:00.000Z",
--     "direction": "sent" | "received",
--     "content": "Texto da mensagem (pode ser vazio se só há screenshot)",
--     "screenshot_urls": ["https://drive.google.com/..."]
--   }
--
-- Não há tabela nova nem RLS adicional — herda as policies de `orders`.
-- ============================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS whatsapp_log JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN orders.whatsapp_log IS
  'Registo manual de conversas WhatsApp. Array JSONB de WhatsAppEntry (ver src/types/whatsapp.ts). Cada item: { id, timestamp, direction, content, screenshot_urls[] }.';

COMMIT;
