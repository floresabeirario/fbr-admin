-- ============================================================
-- Migration 037: Link directo para o evento Google Calendar
-- ============================================================
-- A API do Google Calendar devolve um `htmlLink` por evento que
-- abre directamente o detalhe do evento no Calendar Web. Até
-- agora só guardávamos o `eventId` em `orders.calendar_event_id`,
-- o que obriga a uma chamada API para descobrir o link em cada
-- carregamento do workbench. Persistimos agora o link para que
-- o botão "No Calendar" funcione imediatamente após refresh.
-- ============================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS calendar_event_html_link TEXT;

COMMENT ON COLUMN orders.calendar_event_html_link IS
  'URL directo (htmlLink) para o evento no Google Calendar.';

COMMIT;
