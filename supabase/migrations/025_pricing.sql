-- ============================================================
-- Migration 025: Aba Finanças — Tabela de preços (cálculo automático
-- do orçamento) + snapshot por encomenda
-- ============================================================
-- A spec do CLAUDE.md diz:
--   "Orçamento (admin) — calculado automaticamente a partir dos preços
--    na aba Finanças, editável"
--   "IMPORTANTE: preço em vigor no momento da criação da encomenda deve
--    ser guardado; aumentos futuros não recalculam encomendas antigas"
--
-- Esta migração introduz:
--   1. Tabela `pricing_items` — catálogo de preços actuais (uma linha
--      por componente: tamanho de moldura, suplemento de fundo, extras
--      por unidade). Editável só por admins.
--   2. Coluna `orders.pricing_snapshot JSONB` — guarda o cálculo
--      detalhado feito no momento da criação. Inalterado mesmo que os
--      preços da tabela mudem depois. Estrutura:
--        { computed_at: ISO, total: numeric, lines:
--          [ { category, key, label, qty, unit_price, subtotal } ] }
--   3. Encomendas existentes ficam com snapshot NULL → mantêm o budget
--      manual actual. Só as novas (a partir de agora) usam o cálculo.
--
-- Categorias suportadas:
--   - base_frame             (chave = "30x40" / "40x50" / "50x70")
--   - background_supplement  (chave = "fotografia" / "cor" / etc.)
--   - extra                  (chave = "mini_frame" / "christmas_ornament" / "necklace_pendant")
--
-- O envio (flower_shipping_cost, frame_shipping_cost) NÃO entra no
-- snapshot — continua a ser editado linha-a-linha na encomenda, é um
-- custo logístico variável (CTT consoante destino).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS pricing_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  updated_by      UUID REFERENCES auth.users(id),

  category        TEXT NOT NULL CHECK (category IN (
    'base_frame',
    'background_supplement',
    'extra'
  )),
  key             TEXT NOT NULL,
  label           TEXT NOT NULL,
  price           NUMERIC(10,2) NOT NULL DEFAULT 0,
  position        INT NOT NULL DEFAULT 0,
  notes           TEXT,

  -- Garante que não existem duas linhas activas para a mesma combinação
  CONSTRAINT pricing_items_category_key_unique UNIQUE (category, key)
);

CREATE INDEX IF NOT EXISTS pricing_items_category_idx ON pricing_items(category) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS pricing_items_updated_at ON pricing_items;
CREATE TRIGGER pricing_items_updated_at
  BEFORE UPDATE ON pricing_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE pricing_items ENABLE ROW LEVEL SECURITY;

-- Admins escrevem
DROP POLICY IF EXISTS "pricing_items_admins_all" ON pricing_items;
CREATE POLICY "pricing_items_admins_all" ON pricing_items FOR ALL
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt'
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt'
    )
  );

-- Viewer (Ana) lê — precisa de ver os preços para criar pré-reservas
DROP POLICY IF EXISTS "pricing_items_viewer_select" ON pricing_items;
CREATE POLICY "pricing_items_viewer_select" ON pricing_items FOR SELECT
  USING (auth.jwt() ->> 'email' = 'info+ana@floresabeirario.pt');

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE OR REPLACE FUNCTION log_pricing_item_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('pricing_items', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('pricing_items', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('pricing_items', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS pricing_items_audit ON pricing_items;
CREATE TRIGGER pricing_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON pricing_items
  FOR EACH ROW EXECUTE FUNCTION log_pricing_item_changes();

-- ============================================================
-- GRANTs
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON pricing_items TO authenticated;

-- ============================================================
-- SEED — valores plausíveis (Maria corrige no admin depois)
-- ============================================================
-- Os preços-base partem da regra "vale mínimo = 300€ = 30x40" da spec.
-- Os suplementos e extras são placeholders editáveis.
INSERT INTO pricing_items (category, key, label, price, position, notes) VALUES
  -- Bases por tamanho (valores plausíveis — Maria corrige depois)
  ('base_frame',            '30x40',              'Moldura 30x40',                300, 1, 'Quadro pequeno — equivale ao valor mínimo do vale'),
  ('base_frame',            '40x50',              'Moldura 40x50',                400, 2, NULL),
  ('base_frame',            '50x70',              'Moldura 50x70',                500, 3, NULL),

  -- Suplementos de fundo (0 = sem suplemento; transparente/preto/branco habitualmente neutros)
  ('background_supplement', 'transparente',       'Fundo transparente',             0, 1, 'Padrão — sem suplemento'),
  ('background_supplement', 'preto',              'Fundo preto',                    0, 2, NULL),
  ('background_supplement', 'branco',             'Fundo branco',                   0, 3, NULL),
  ('background_supplement', 'fotografia',         'Fundo fotografia',              30, 4, 'Suplemento por impressão e enquadramento personalizado'),
  ('background_supplement', 'cor',                'Fundo cor (à escolha)',         20, 5, 'Suplemento por tinta personalizada'),
  ('background_supplement', 'voces_a_escolher',   'Fundo: vocês a escolher',        0, 6, 'A definir na conversa de confirmação'),
  ('background_supplement', 'nao_sei',            'Fundo: não sei',                 0, 7, 'A definir na conversa de confirmação'),

  -- Extras por unidade
  ('extra',                 'mini_frame',         'Quadro extra pequeno',          45, 1, 'Por unidade'),
  ('extra',                 'christmas_ornament', 'Ornamento de Natal',            25, 2, 'Por unidade'),
  ('extra',                 'necklace_pendant',   'Pendente para colar',           15, 3, 'Por unidade')
ON CONFLICT (category, key) DO NOTHING;

-- ============================================================
-- Snapshot de preços por encomenda
-- ============================================================
-- Coluna opcional: encomendas antigas (criadas antes desta migração)
-- continuam com `budget` manual e snapshot NULL. Encomendas novas vão
-- ter snapshot preenchido pelo `createOrderAction` (server action).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB;

COMMENT ON COLUMN orders.pricing_snapshot IS
  'Snapshot dos preços usados para calcular o orçamento na criação da encomenda. Estrutura: { computed_at, total, lines: [{category, key, label, qty, unit_price, subtotal}] }. NULL para encomendas antigas (budget continua manual).';

COMMIT;
