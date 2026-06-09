-- ============================================================
-- Migration 073: Fundo próprio para os quadros extra pequenos
-- ============================================================
-- Contexto:
-- Até agora `frame_background` era um único valor para a encomenda
-- toda. Há casos recorrentes em que o quadro principal e o(s)
-- quadro(s) extra pequeno(s) têm fundos diferentes (ex.: principal
-- transparente + extra branco). Esta coluna guarda o fundo dos
-- quadros extra, independente do principal.
--
-- Mesmas opções que `frame_background`. NULL = "usa o mesmo fundo do
-- principal / não especificado" (default; não força nada).
--
-- Só ALTER numa tabela existente → sem tabelas novas, sem grants
-- novos (project_supabase_public_grants_2026 não se aplica).
-- ============================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS extra_small_frames_background TEXT
    CHECK (extra_small_frames_background IN (
      'transparente', 'preto', 'branco',
      'fotografia', 'cor', 'voces_a_escolher', 'nao_sei'
    ));

COMMENT ON COLUMN orders.extra_small_frames_background IS
  'Fundo dos quadros extra pequenos quando difere do quadro principal (frame_background). Mesmas opções. NULL = não especificado / igual ao principal.';

COMMIT;

-- ============================================================
-- Verificação rápida (correr depois da migração):
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='orders' AND column_name='extra_small_frames_background';
--   -- 1 linha
-- ============================================================
