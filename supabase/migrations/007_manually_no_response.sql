-- ============================================================
-- FBR Admin — Sessão 16: mover encomenda para "Sem resposta" manualmente
-- Executar no Supabase SQL Editor
-- ============================================================

-- Permite marcar uma pré-reserva como "Sem resposta" mesmo antes
-- de passarem 4 dias (a regra automática continua a funcionar).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS manually_no_response BOOLEAN NOT NULL DEFAULT false;
