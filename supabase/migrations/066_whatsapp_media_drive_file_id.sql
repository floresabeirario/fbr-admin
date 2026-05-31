-- ============================================================
-- Migration 066: media_drive_file_id em whatsapp_messages
-- ============================================================
-- Para renderizar thumbnails inline (em vez de so link 'Abrir na Drive')
-- precisamos do ID do ficheiro na Drive. A rota /api/whatsapp/media/<id>
-- recebe esse id, autentica via OAuth da integracao FBR e devolve os
-- bytes do ficheiro com Cache-Control para o browser cachear.
--
-- Anteriormente so guardavamos media_url_drive (webViewLink) que abre
-- na UI da Drive — nao serve para embed.
-- ============================================================

BEGIN;

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_drive_file_id TEXT;

COMMENT ON COLUMN whatsapp_messages.media_drive_file_id IS
  'Drive file ID guardado em uploadWhatsappMedia; usado pelo proxy /api/whatsapp/media/[fileId] para servir bytes inline.';

COMMIT;
