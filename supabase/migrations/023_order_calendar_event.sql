-- ============================================================
-- Migration 023: Coluna calendar_event_id em orders
-- ============================================================
-- Fase 6 (sessão 38): integração Google Calendar.
--
-- Ao 1º pagamento de uma encomenda criamos um evento no calendário
-- "Preservação de Flores" (criado/cacheado em google_integration.calendar_id
-- na migração 022) com a data do evento do cliente.
--
-- O ID do evento criado é persistido aqui para podermos:
--   - actualizar o evento se a data ou nome do cliente mudarem
--   - apagar o evento se a encomenda passar a "cancelado"
--
-- Vales NÃO geram eventos (decisão da Maria — só encomendas).
-- ============================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

COMMIT;
