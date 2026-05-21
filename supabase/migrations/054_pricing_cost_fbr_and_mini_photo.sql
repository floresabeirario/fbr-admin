-- ============================================================
-- Migration 054: Custo FBR para extras + suplemento foto para mini
-- ============================================================
-- Suporta o redesenho da aba Catálogo → tabela "Margem teórica"
-- editável (sessão Maria) que substitui as 3 subsecções da antiga
-- PrecosTab (Moldura / Suplemento por fundo / Extras por unidade).
--
-- Duas alterações combinadas porque ambas tocam pricing_items:
--
-- 1. `pricing_items.cost_fbr NUMERIC(10,2)` — custo interno por
--    unidade dos extras (ornamento de Natal, pendente para colar).
--    NULL para items onde "custo FBR" não faz sentido (base_frame,
--    background_supplement) — esses derivam dos production_cost_items.
--    Para `extra.mini_frame`, também fica NULL: o custo do mini
--    deriva das tabelas de produção (mini_20x25 baixa cartão).
--
-- 2. Item novo `background_supplement.fotografia_mini` — suplemento
--    de preço cliente quando o cliente escolhe foto + minis. Aplicado
--    por cada mini (multiplicado pela quantidade). Valor 0 placeholder
--    — Maria edita depois quando souber.
--
-- O computePricingSnapshot em src/lib/pricing.ts já tem que ser
-- alterado em paralelo para somar este suplemento por cada mini.
-- ============================================================

BEGIN;

-- ── 1. Coluna cost_fbr ────────────────────────────────────────
ALTER TABLE pricing_items
  ADD COLUMN IF NOT EXISTS cost_fbr NUMERIC(10,2);

COMMENT ON COLUMN pricing_items.cost_fbr IS
  'Custo interno FBR por unidade (apenas para extras como ornamento e pendente, onde não há production_cost_item dedicado). NULL para items cujo custo vem das tabelas de produção (mini_frame) ou onde o conceito não se aplica (base_frame, background_supplement).';

-- Inicializar a 0 nos extras que vão precisar (placeholder editável).
-- mini_frame fica NULL deliberadamente — custo vem das tabelas de produção.
UPDATE pricing_items
  SET cost_fbr = 0
  WHERE category = 'extra'
    AND key IN ('christmas_ornament', 'necklace_pendant')
    AND deleted_at IS NULL
    AND cost_fbr IS NULL;

-- ── 2. Novo item: suplemento foto para mini 20x25 ─────────────
INSERT INTO pricing_items (category, key, label, price, position, notes) VALUES
  ('background_supplement', 'fotografia_mini', 'Suplemento fotografia · 20x25 mini', 0, 8, 'Aplicado por cada mini quando o cliente escolhe fundo fotografia. Placeholder a 0 — Maria edita quando souber.')
ON CONFLICT (category, key) DO NOTHING;

COMMIT;

-- ============================================================
-- VERIFICAÇÃO MANUAL (correr depois)
-- ============================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='pricing_items' AND column_name='cost_fbr';
--   → 1 linha
--
-- SELECT category, key, label, price, cost_fbr
--   FROM pricing_items
--   WHERE category='extra' OR key='fotografia_mini'
--   ORDER BY category, position;
--   → mini_frame (cost_fbr NULL), christmas_ornament (cost_fbr 0),
--     necklace_pendant (cost_fbr 0), pyramid_frame (cost_fbr NULL),
--     fotografia_mini (background_supplement, price 0)
