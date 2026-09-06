-- ============================================================
-- 105 — Custo real do vidro + vidro museu nos mini-quadros
-- ============================================================
-- Complemento da 104 (que pôs o vidro museu a preço). Duas coisas:
--
--   1. PREÇO: os mini-quadros 20x25 têm ESCOLHA PRÓPRIA de vidro
--      (`orders.museum_glass_mini`), independente do quadro principal:
--      pode querer museu no grande e normal nos pequenos, ou o inverso.
--      Suplemento de 20€ POR CADA mini, quando essa escolha é 'sim'.
--      Mesma mecânica do `fotografia_mini` (mig 054).
--
--      ⚠️ Tal como o quadro principal na 104, TODOS os minis feitos até
--      26/08/2026 levaram vidro museu dentro do preço: a coluna nasce
--      com 'incluido' em todas as encomendas, estado que nunca cobra.
--
--   2. CUSTO: até agora TODOS os quadros levavam vidro museu, por isso
--      os custos em production_cost_items (30x40 baixa vidro/vidro =
--      49,80€, etc.) já o têm lá dentro. Agora que há quadros com vidro
--      normal, esses custam menos e a margem tem de o reflectir.
--
-- ⚠️ COMO O CUSTO FUNCIONA (importante para quem editar isto depois):
--    o custo da moldura em production_cost_items CONTINUA a assumir
--    vidro museu. Quando o cliente escolhe vidro normal, o cálculo
--    SUBTRAI a diferença (museu menos normal) deste tabela nova.
--    Não se mexeu nos 22 valores já lá dentro: não sabemos ao cêntimo
--    que fatia deles é vidro, e a diferença é o que importa.
--
--    Valores da tabela do fornecedor (com 25% de desconto), 26/08/2026:
--      tamanho      normal    museu     diferença
--      30x40        3,96      22,50     18,54
--      40x50        6,60      37,50     30,90
--      50x70       11,55      65,63     54,08
--      20x25 mini   1,65       9,38      7,73
--
--    Só desconta quando museum_glass = 'nao' (decisão firme do cliente).
--    Em 'sim' e 'incluido' o quadro leva mesmo vidro museu; em 'nao_sei'
--    assume-se o custo maior, para a margem nunca aparecer inflacionada
--    antes de a escolha estar fechada.
--
-- Sem tabelas novas → os GRANTs de production_cost_items/pricing_items servem.
-- ============================================================

-- ── 1a. Escolha de vidro própria para os mini-quadros ───────
-- Mesmos 4 estados e mesma mecânica de backfill da coluna museum_glass
-- (mig 104): nasce 'incluido' para tudo o que já existe, e o default
-- passa a 'nao_sei' para as encomendas novas.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS museum_glass_mini TEXT NOT NULL DEFAULT 'incluido';

UPDATE orders SET museum_glass_mini = 'incluido' WHERE museum_glass_mini IS NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_museum_glass_mini_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_museum_glass_mini_check
  CHECK (museum_glass_mini IN ('incluido', 'sim', 'nao', 'nao_sei'));

ALTER TABLE orders ALTER COLUMN museum_glass_mini SET DEFAULT 'nao_sei';

COMMENT ON COLUMN orders.museum_glass_mini IS
  'Vidro dos mini-quadros 20x25, escolha independente do quadro principal (museum_glass). Mesmos estados: incluido = anterior a 26/08/2026, nunca cobra. sim = cobra pricing_items.glass_supplement.museum_glass_20x25 por cada mini. So relevante quando extra_small_frames = sim.';

-- ── 1b. Preço do vidro museu no mini-quadro ─────────────────
INSERT INTO pricing_items (category, key, label, price, position, notes) VALUES
  ('glass_supplement', 'museum_glass_20x25', 'Vidro museu UltraVue 20x25 (mini)', 20, 4,
   'Aplicado por cada mini-quadro quando orders.museum_glass_mini = sim. Escolha independente do quadro principal. Mesma mecanica do fotografia_mini.')
ON CONFLICT (category, key) DO NOTHING;

-- ── 2. Nova espécie de custo: o vidro em si ─────────────────
ALTER TABLE production_cost_items
  ADD COLUMN IF NOT EXISTS glass_grade TEXT;

ALTER TABLE production_cost_items DROP CONSTRAINT IF EXISTS production_cost_glass_grade_check;
ALTER TABLE production_cost_items
  ADD CONSTRAINT production_cost_glass_grade_check
  CHECK (glass_grade IS NULL OR glass_grade IN ('normal', 'museu'));

-- kind ganha 'glass'. ('consumable' entrou na mig 035; repetimos a lista
-- inteira porque um CHECK não se estende, substitui-se.)
ALTER TABLE production_cost_items DROP CONSTRAINT IF EXISTS production_cost_items_kind_check;
ALTER TABLE production_cost_items
  ADD CONSTRAINT production_cost_items_kind_check
  CHECK (kind IN ('frame', 'photo_print', 'consumable', 'glass'));

-- O CHECK que amarra os campos a cada kind. 'glass' quer glass_grade e
-- não quer frame_type/glass_type (que descrevem a montagem, não o vidro).
ALTER TABLE production_cost_items DROP CONSTRAINT IF EXISTS production_cost_kind_fields_check;
ALTER TABLE production_cost_items
  ADD CONSTRAINT production_cost_kind_fields_check
  CHECK (
    (kind = 'frame'       AND frame_type IS NOT NULL AND glass_type IS NOT NULL AND glass_grade IS NULL)
    OR
    (kind = 'photo_print' AND frame_type IS NULL     AND glass_type IS NULL     AND glass_grade IS NULL)
    OR
    (kind = 'consumable'  AND frame_type IS NULL     AND glass_type IS NULL     AND glass_grade IS NULL)
    OR
    (kind = 'glass'       AND frame_type IS NULL     AND glass_type IS NULL     AND glass_grade IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS production_cost_glass_unique
  ON production_cost_items(size_key, glass_grade)
  WHERE kind = 'glass' AND deleted_at IS NULL;

COMMENT ON COLUMN production_cost_items.glass_grade IS
  'So para kind=glass: normal ou museu. O custo da moldura (kind=frame) ja assume vidro museu; quando o cliente escolhe normal, o calculo subtrai (museu menos normal) daqui.';

-- ── 3. Custos do vidro (tabela do fornecedor, 25% desc.) ────
INSERT INTO production_cost_items (kind, size_key, glass_grade, cost, position, notes) VALUES
  ('glass', '30x40',      'normal',  3.96, 51, 'Tabela do fornecedor com 25% desc. (26/08/2026)'),
  ('glass', '30x40',      'museu',  22.50, 52, 'Tabela do fornecedor com 25% desc. (26/08/2026)'),
  ('glass', '40x50',      'normal',  6.60, 53, 'Tabela do fornecedor com 25% desc. (26/08/2026)'),
  ('glass', '40x50',      'museu',  37.50, 54, 'Tabela do fornecedor com 25% desc. (26/08/2026)'),
  ('glass', '50x70',      'normal', 11.55, 55, 'Tabela do fornecedor com 25% desc. (26/08/2026)'),
  ('glass', '50x70',      'museu',  65.63, 56, 'Tabela do fornecedor com 25% desc. (26/08/2026)'),
  ('glass', 'mini_20x25', 'normal',  1.65, 57, 'Tabela do fornecedor com 25% desc. (26/08/2026)'),
  ('glass', 'mini_20x25', 'museu',   9.38, 58, 'Tabela do fornecedor com 25% desc. (26/08/2026)')
ON CONFLICT DO NOTHING;

-- ============================================================
-- VERIFICAÇÃO (correr depois, no SQL Editor)
-- ============================================================
-- 1) Os 8 custos de vidro e as 4 diferenças que o cálculo vai usar:
--    SELECT size_key,
--           MAX(cost) FILTER (WHERE glass_grade = 'museu')  AS museu,
--           MAX(cost) FILTER (WHERE glass_grade = 'normal') AS normal,
--           MAX(cost) FILTER (WHERE glass_grade = 'museu')
--             - MAX(cost) FILTER (WHERE glass_grade = 'normal') AS poupanca
--    FROM production_cost_items
--    WHERE kind = 'glass' AND deleted_at IS NULL
--    GROUP BY size_key ORDER BY size_key;
--    → esperado: 30x40 18,54 · 40x50 30,90 · 50x70 54,08 · mini_20x25 7,73
--
-- 2) Os minis das encomendas actuais têm todos de estar em 'incluido':
--    SELECT museum_glass_mini, count(*) FROM orders GROUP BY 1 ORDER BY 2 DESC;
--    → esperado: uma única linha, 'incluido', com o total de encomendas.
--
-- 3) Os 4 preços do vidro museu ao cliente:
--    SELECT key, price FROM pricing_items
--    WHERE category = 'glass_supplement' AND deleted_at IS NULL ORDER BY position;
--    → esperado: 30x40 45 · 40x50 65 · 50x70 115 · 20x25 20
