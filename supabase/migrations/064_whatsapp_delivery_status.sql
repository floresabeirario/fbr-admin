-- ============================================================
-- Migration 064: Status de entrega das mensagens WhatsApp
-- ============================================================
-- A Meta envia eventos 'statuses' separadamente das mensagens, com
-- delivered/read/failed para as mensagens que SAEM (echoes do telemovel).
-- Ate aqui ignoravamos. Agora guardamos para mostrar ✓ / ✓✓ / ✓✓ azul
-- nas bolhas.
--
-- Colunas:
--  - delivery_status: NULL (default) / 'delivered' / 'read' / 'failed'
--  - delivered_at: quando a Meta confirmou entrega
--  - read_at: quando o destinatario abriu (se tem read receipts ligadas)
-- ============================================================

BEGIN;

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS delivery_status TEXT
    CHECK (delivery_status IS NULL OR delivery_status IN ('delivered', 'read', 'failed')),
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

COMMENT ON COLUMN whatsapp_messages.delivery_status IS
  'Status reportado pela Meta. NULL = sem status (default ou nao aplica). Apenas mensagens sent_echo terao status; received fica sempre NULL.';

COMMIT;
