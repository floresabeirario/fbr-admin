-- ============================================================
-- 099 — Sinalização interna "no desidratador"
-- ============================================================
-- Sistema SÓ interno para saber que encomendas estão neste momento dentro
-- do desidratador. As flores entram no desidratador nos primeiros dias
-- após serem recebidas (fase "Preservação e design") e vão-se tirando/
-- pondo ao longo dos dias. A Maria liga/desliga este sinal à mão nos cards
-- e no workbench; NADA no site público, NADA de automático.
--
-- Só aparece na categoria "Preservação e design". Booleano simples: true =
-- está no desidratador; false (default) = card normal.
--
-- O QUE MUDA: uma coluna booleana nova em orders, NOT NULL default false.
-- Aditiva; encomendas antigas ficam a false (fora do desidratador).
--
-- GRANTS: `orders` já existia antes de 30/10/2026 e os GRANTs são ao nível
-- da tabela, por isso a coluna nova herda automaticamente os privilégios
-- existentes (SELECT/UPDATE do papel authenticated) — nada a fazer.
--
-- ROLLOUT: correr no SQL Editor antes (ou junto) do deploy do admin que
-- passa a ler/escrever esta coluna.
-- ============================================================

BEGIN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS in_dehydrator boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN orders.in_dehydrator IS
  'Sinalização interna: encomenda está neste momento dentro do desidratador (fase Preservação e design). Ligada/desligada à mão pela Maria nos cards e no workbench. Sem efeito no site público.';

COMMIT;

-- ── Verificação (correr depois, no SQL Editor) ──────────────
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'orders' AND column_name = 'in_dehydrator';
