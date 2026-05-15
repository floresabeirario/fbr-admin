-- ============================================================
-- Migration 036: Contacto da pessoa que estará na recolha
-- ============================================================
-- Por vezes o cliente não está presente na recolha das flores
-- (ex: casamento, funeral) e indica um amigo/familiar como ponto
-- de contacto. Estes campos guardam o nome e telemóvel dessa
-- pessoa, mostrados no workbench, na agenda de recolhas e na
-- descrição do evento Google Calendar.
-- ============================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pickup_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS pickup_contact_phone TEXT;

COMMENT ON COLUMN orders.pickup_contact_name IS
  'Nome de quem estará no local da recolha (amigo/familiar do cliente).';
COMMENT ON COLUMN orders.pickup_contact_phone IS
  'Telemóvel de quem estará no local da recolha (amigo/familiar do cliente).';

COMMIT;
