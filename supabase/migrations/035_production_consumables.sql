-- ============================================================
-- Migration 035: Consumíveis de produção (caixa, autocolante, lavanda,
-- cartão informativo, padding, sílica, sacos de pano, etc.)
-- ============================================================
-- Maria pediu: cada encomenda leva uma lista de pequenos consumíveis
-- por tamanho. Caixa de cartão, autocolante frágil, saco pano grande,
-- saco pano mini, lavanda 40g, cartão informativo, padding insuflável,
-- sacos de sílica. Custo varia por tamanho da moldura.
--
-- Requisitos:
--   1. Maria pode adicionar/remover/renomear linhas livremente
--      (label livre, não enum). Hoje são 8 itens; amanhã podem ser 10.
--   2. Aplica-se a TODOS os quadros automaticamente — soma ao custo
--      de produção consoante o tamanho da moldura.
--   3. Custos com 4 decimais (alguns são frações de cêntimo: 0,0240€,
--      0,3667€). A tabela existente usa NUMERIC(10,2) → upgrade para
--      NUMERIC(12,4) sem perda de dados.
--   4. Mini 20x25 não tem consumíveis ainda (entram no pacote do
--      quadro principal). A estrutura aceita-os no futuro — basta a
--      Maria adicionar linhas com `size_key='mini_20x25'`.
--
-- Esta migração:
--   1. Aumenta precisão de `production_cost_items.cost` para NUMERIC(12,4).
--   2. Adiciona `kind='consumable'` ao CHECK constraint.
--   3. Adiciona coluna `label TEXT` — livre, editável pela Maria. Para
--      consumables é obrigatório; para frame/photo_print é opcional
--      (derivamos label dos campos estruturados).
--   4. Substitui o unique constraint frame por um que aceita o novo
--      kind sem duplicação acidental.
--   5. Seed: 8 consumables × 3 tamanhos (30x40, 40x50, 50x70) = 24 linhas.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Aumenta precisão do custo (alguns consumables têm 4 decimais).
--    Conversão é lossless: NUMERIC(10,2) → NUMERIC(12,4) só adiciona
--    casas decimais à direita.
-- ------------------------------------------------------------
ALTER TABLE production_cost_items
  ALTER COLUMN cost TYPE NUMERIC(12,4);

-- ------------------------------------------------------------
-- 2. Adiciona kind 'consumable' + coluna label.
--    Como CHECK não suporta ALTER, droppamos e recriamos.
-- ------------------------------------------------------------
ALTER TABLE production_cost_items
  ADD COLUMN IF NOT EXISTS label TEXT;

ALTER TABLE production_cost_items
  DROP CONSTRAINT IF EXISTS production_cost_items_kind_check;

ALTER TABLE production_cost_items
  ADD CONSTRAINT production_cost_items_kind_check
  CHECK (kind IN ('frame', 'photo_print', 'consumable'));

-- O CHECK de "campos obrigatórios por kind" também precisa de ser
-- relaxado para aceitar consumables (label obrigatório; frame_type
-- e glass_type ficam null).
ALTER TABLE production_cost_items
  DROP CONSTRAINT IF EXISTS production_cost_kind_fields_check;

ALTER TABLE production_cost_items
  ADD CONSTRAINT production_cost_kind_fields_check CHECK (
    (kind = 'frame'
      AND frame_type IS NOT NULL
      AND glass_type IS NOT NULL)
    OR
    (kind = 'photo_print'
      AND frame_type IS NULL
      AND glass_type IS NULL)
    OR
    (kind = 'consumable'
      AND frame_type IS NULL
      AND glass_type IS NULL
      AND label IS NOT NULL
      AND length(trim(label)) > 0)
  );

-- ------------------------------------------------------------
-- 3. Índices únicos. Para consumables a unicidade é (size_key, label)
--    para evitar duas linhas idênticas no mesmo tamanho. A Maria pode
--    ter o mesmo label em tamanhos diferentes (ex: "Caixa de cartão"
--    em 30x40 e em 40x50 com custos diferentes).
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS production_cost_consumable_unique
  ON production_cost_items(size_key, label)
  WHERE kind = 'consumable' AND deleted_at IS NULL;

-- ------------------------------------------------------------
-- 4. SEED — 8 consumables × 3 tamanhos (mini 20x25 fica para depois,
--    quando a Maria começar a embalar os mini-quadros em separado).
-- ------------------------------------------------------------
INSERT INTO production_cost_items (kind, size_key, label, cost, position) VALUES
  ('consumable', '30x40', 'Caixa de cartão',      2.3370,  61),
  ('consumable', '40x50', 'Caixa de cartão',      3.0780,  62),
  ('consumable', '50x70', 'Caixa de cartão',      4.3985,  63),

  ('consumable', '30x40', 'Autocolante frágil',   0.0240,  71),
  ('consumable', '40x50', 'Autocolante frágil',   0.0240,  72),
  ('consumable', '50x70', 'Autocolante frágil',   0.0240,  73),

  ('consumable', '30x40', 'Saco pano grande',     5.0000,  81),
  ('consumable', '40x50', 'Saco pano grande',     7.5000,  82),
  ('consumable', '50x70', 'Saco pano grande',    10.0000,  83),

  ('consumable', '30x40', 'Saco pano mini',       2.0000,  91),
  ('consumable', '40x50', 'Saco pano mini',       2.0000,  92),
  ('consumable', '50x70', 'Saco pano mini',       2.0000,  93),

  ('consumable', '30x40', 'Lavanda (40g)',        0.7320, 101),
  ('consumable', '40x50', 'Lavanda (40g)',        0.7320, 102),
  ('consumable', '50x70', 'Lavanda (40g)',        0.7320, 103),

  ('consumable', '30x40', 'Cartão informativo',   0.9700, 111),
  ('consumable', '40x50', 'Cartão informativo',   0.9700, 112),
  ('consumable', '50x70', 'Cartão informativo',   0.9700, 113),

  ('consumable', '30x40', 'Padding insuflável',   0.3667, 121),
  ('consumable', '40x50', 'Padding insuflável',   0.5976, 122),
  ('consumable', '50x70', 'Padding insuflável',   0.6110, 123),

  ('consumable', '30x40', 'Sacos de sílica',      0.0170, 131),
  ('consumable', '40x50', 'Sacos de sílica',      0.0170, 132),
  ('consumable', '50x70', 'Sacos de sílica',      0.0170, 133)
ON CONFLICT DO NOTHING;

COMMIT;
