-- ============================================================
-- Migration 057: Backfill consumíveis para os 3 size_keys novos
-- ============================================================
-- A mig 056 adicionou suporte para `mini_20x25`, `christmas_ornament`
-- e `necklace_pendant` como size_keys de consumíveis. Mas os 8
-- consumíveis seeded em mig 035 (Caixa, Lavanda, Sílica, etc.) só têm
-- linhas para 30x40/40x50/50x70 — as 3 colunas novas na UI aparecem
-- como "—" (não editável).
--
-- Esta migração insere uma linha com cost=0 para cada combinação
-- consumível-existente × size_key-em-falta. Maria edita depois na UI
-- os valores que se aplicam (deixa 0 onde o consumível não é usado).
--
-- A action `createConsumableAction` já insere 6 linhas em consumíveis
-- novos (post mig 056), por isso este backfill só toca em consumíveis
-- pré-existentes.
-- ============================================================

BEGIN;

INSERT INTO production_cost_items (kind, size_key, label, cost, position)
SELECT
  'consumable',
  new_size,
  existing.label,
  0,
  existing.position
FROM (
  -- Cada (label, position) único de consumíveis activos.
  SELECT DISTINCT ON (label) label, position
  FROM production_cost_items
  WHERE kind = 'consumable' AND deleted_at IS NULL
  ORDER BY label, position
) existing
CROSS JOIN (
  VALUES ('mini_20x25'), ('christmas_ornament'), ('necklace_pendant')
) AS new_sizes(new_size)
WHERE NOT EXISTS (
  SELECT 1 FROM production_cost_items pci
  WHERE pci.kind = 'consumable'
    AND pci.label = existing.label
    AND pci.size_key = new_sizes.new_size
    AND pci.deleted_at IS NULL
);

COMMIT;

-- ============================================================
-- VERIFICAÇÃO MANUAL
-- ============================================================
-- Após correr, cada consumível deve ter 6 linhas (uma por size_key):
--
-- SELECT label, count(*) AS rows
-- FROM production_cost_items
-- WHERE kind='consumable' AND deleted_at IS NULL
-- GROUP BY label
-- ORDER BY label;
-- → cada label com 6.
--
-- E os totais por size_key novo devem ser 8 (um por consumível):
-- SELECT size_key, count(*) FROM production_cost_items
-- WHERE kind='consumable' AND deleted_at IS NULL
--   AND size_key IN ('mini_20x25','christmas_ornament','necklace_pendant')
-- GROUP BY size_key;
-- → 3 linhas, cada com count 8.
