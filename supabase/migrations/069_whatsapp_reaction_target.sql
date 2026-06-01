-- ============================================================
-- Migration 069: target_wamid das reaccoes WhatsApp
-- ============================================================
-- Reaccoes (emoji ❤️ a uma mensagem) estavam a aparecer como bolhas
-- isoladas. A informacao 'qual mensagem foi reagida' vinha no payload
-- da Meta mas nao a guardavamos em coluna estavel.
--
-- Esta migracao:
--  1. Adiciona reaction_target_wamid TEXT (NULL quando nao aplica)
--  2. Backfill: extrai do meta_payload->reaction->>message_id para
--     reaccoes ja inseridas, para que apareçam correctamente na UI.
-- ============================================================

BEGIN;

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS reaction_target_wamid TEXT;

UPDATE whatsapp_messages
SET reaction_target_wamid = meta_payload->'reaction'->>'message_id'
WHERE content_type = 'reaction'
  AND reaction_target_wamid IS NULL
  AND meta_payload->'reaction'->>'message_id' IS NOT NULL;

COMMENT ON COLUMN whatsapp_messages.reaction_target_wamid IS
  'Wamid da mensagem reagida. NULL excepto quando content_type=reaction. Permite renderizar a reaccao como badge anexa em vez de bolha isolada.';

COMMIT;
