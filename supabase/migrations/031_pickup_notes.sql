-- ============================================================
-- Migration 031: Notas internas para recolha no local
-- ============================================================
-- Campo de texto livre destinado a info logística para quem vai
-- fazer a recolha (ex: "é o pai da noiva que vai entregar as
-- flores", "tocar à campainha 3 vezes", "estacionamento à frente
-- da igreja"). Aparece no workbench junto da morada/hora da
-- recolha e em destaque na página Entregas e Recolhas.
--
-- Distinto de:
--  - additional_notes (preenchido pelo cliente no form público)
--  - sticky_note (post-it amarelo geral da encomenda)
-- ============================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pickup_notes TEXT;

COMMENT ON COLUMN orders.pickup_notes IS
  'Notas internas sobre a recolha no local (info para quem vai recolher).';

COMMIT;
