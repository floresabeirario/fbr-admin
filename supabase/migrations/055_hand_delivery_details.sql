-- ============================================================
-- Migration 055: Detalhes da entrega "em mãos" das flores
-- ============================================================
-- Quando o cliente escolhe "em mãos" como método de envio das
-- flores (flower_delivery_method = 'maos'), passa a poder
-- registar quem vem entregar, em que dia, a partir de que horas,
-- contacto e notas. Mesma lógica que os campos pickup_* mas sem
-- morada (a entrega é sempre no atelier FBR).
--
-- Estes campos alimentam:
--  - a caixa azul de "Detalhes da entrega em mãos" no workbench
--    (visível apenas quando flower_delivery_method = 'maos')
--  - a descrição do evento Google Calendar associado à encomenda
--    (mesma janela horária faz o evento ser timed em vez de all-day)
-- ============================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS hand_delivery_date         DATE,
  ADD COLUMN IF NOT EXISTS hand_delivery_time_from    TIME,
  ADD COLUMN IF NOT EXISTS hand_delivery_time_to      TIME,
  ADD COLUMN IF NOT EXISTS hand_delivery_contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS hand_delivery_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS hand_delivery_notes         TEXT;

COMMENT ON COLUMN orders.hand_delivery_date IS
  'Data em que o cliente (ou pessoa indicada) traz as flores em mãos ao atelier FBR.';
COMMENT ON COLUMN orders.hand_delivery_time_from IS
  'Hora a partir da qual a pessoa traz as flores ao atelier.';
COMMENT ON COLUMN orders.hand_delivery_time_to IS
  'Hora limite da janela de entrega (opcional).';
COMMENT ON COLUMN orders.hand_delivery_contact_name IS
  'Nome de quem vem entregar as flores (cliente, amigo, familiar).';
COMMENT ON COLUMN orders.hand_delivery_contact_phone IS
  'Telemóvel de quem vem entregar as flores.';
COMMENT ON COLUMN orders.hand_delivery_notes IS
  'Notas internas sobre a entrega em mãos (ex: "vem com o pai", "tem dificuldade em estacionar").';

COMMIT;
