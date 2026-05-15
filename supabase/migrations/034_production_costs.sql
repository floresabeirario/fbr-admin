-- ============================================================
-- Migration 034: Custos de Produção (COGS) + tipo de moldura
-- ============================================================
-- Maria pediu (Finanças):
--   Capturar o custo de produzir cada quadro completo (moldura,
--   embalagem, cartão informativo, enchimento, autocolante, etc.)
--   para conseguir contabilizar margens reais. Distinto das
--   "despesas únicas" (que são custos operacionais como software,
--   renda, ferramentas).
--
-- Variáveis do custo:
--   - Tamanho            : 30x40, 40x50, 50x70 (públicos)
--                        + mini_20x25 (interno — usado para `extra_small_frames`)
--   - Tipo de moldura    : baixa (2x2cm), caixa (2x3cm), piramide
--                          - baixa vs caixa = decisão INTERNA da Maria
--                            consoante a altura das flores. Cliente paga
--                            o mesmo, só a margem da FBR varia.
--                          - piramide = upgrade visível ao cliente
--                            (cliente paga suplemento — vem do form).
--   - Tipo de vidro      : vidro_vidro  (= cliente escolheu "transparente")
--                          vidro_cartao (= cliente escolheu preto/branco/cor/fotografia)
--   - Fotografia         : custo de impressão por tamanho, somado ao
--                          custo do quadro quando frame_background='fotografia'.
--
-- Tudo versionado em "snapshot" por encomenda igual ao pricing_snapshot:
-- alterações futuras à tabela de custos NÃO recalculam encomendas antigas.
--
-- Esta migração introduz:
--   1. Tabela `production_cost_items` — uma linha por combinação possível.
--      (3 tipos × 2 vidros × 4 tamanhos = 24 linhas tipo "frame" + 4 linhas
--       tipo "photo_print" = 28 linhas).
--   2. Colunas em `orders`:
--      - `pyramid_frame BOOLEAN` (cliente escolhe; afecta custo + preço)
--      - `frame_internal_type TEXT` (admin decide: 'baixa' | 'caixa') —
--        só relevante quando pyramid_frame=false. Quando piramide=true,
--        o tipo é implicitamente 'piramide'.
--      - `production_cost_snapshot JSONB` — cópia integral dos custos
--        vigentes no momento da criação. Total recalculado on-the-fly
--        com os campos da encomenda.
--   3. Aplicar `pricing_items.extra.pyramid_frame` AUTOMATICAMENTE ao
--      pricing_snapshot quando pyramid_frame=true (lógica em src/lib/pricing.ts).
--      A migração 033 já criou esse item com preço 0 — fica à Maria definir
--      o suplemento na UI.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. TABELA production_cost_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS production_cost_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  updated_by      UUID REFERENCES auth.users(id),

  kind            TEXT NOT NULL CHECK (kind IN ('frame', 'photo_print')),
  size_key        TEXT NOT NULL CHECK (size_key IN ('30x40', '40x50', '50x70', 'mini_20x25')),
  frame_type      TEXT CHECK (frame_type IS NULL OR frame_type IN ('baixa', 'caixa', 'piramide')),
  glass_type      TEXT CHECK (glass_type IS NULL OR glass_type IN ('vidro_vidro', 'vidro_cartao')),
  cost            NUMERIC(10,2) NOT NULL DEFAULT 0,
  position        INT NOT NULL DEFAULT 0,
  notes           TEXT,

  -- "frame" precisa de frame_type+glass_type; "photo_print" não (é por tamanho).
  CONSTRAINT production_cost_kind_fields_check CHECK (
    (kind = 'frame'       AND frame_type IS NOT NULL AND glass_type IS NOT NULL)
    OR
    (kind = 'photo_print' AND frame_type IS NULL     AND glass_type IS NULL)
  )
);

-- Unicidade por combinação activa.
CREATE UNIQUE INDEX IF NOT EXISTS production_cost_frame_unique
  ON production_cost_items(size_key, frame_type, glass_type)
  WHERE kind = 'frame' AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS production_cost_photo_unique
  ON production_cost_items(size_key)
  WHERE kind = 'photo_print' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS production_cost_kind_idx
  ON production_cost_items(kind) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS production_cost_items_updated_at ON production_cost_items;
CREATE TRIGGER production_cost_items_updated_at
  BEFORE UPDATE ON production_cost_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 2. RLS — admin escreve, Ana lê (precisa para ver a margem)
-- ------------------------------------------------------------
ALTER TABLE production_cost_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "production_cost_items_admins_all" ON production_cost_items;
CREATE POLICY "production_cost_items_admins_all" ON production_cost_items FOR ALL
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

DROP POLICY IF EXISTS "production_cost_items_viewer_select" ON production_cost_items;
CREATE POLICY "production_cost_items_viewer_select" ON production_cost_items FOR SELECT
  USING (auth.jwt() ->> 'email' = 'info+ana@floresabeirario.pt');

-- ------------------------------------------------------------
-- 3. AUDIT LOG
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_production_cost_item_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('production_cost_items', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('production_cost_items', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('production_cost_items', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS production_cost_items_audit ON production_cost_items;
CREATE TRIGGER production_cost_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON production_cost_items
  FOR EACH ROW EXECUTE FUNCTION log_production_cost_item_changes();

-- ------------------------------------------------------------
-- 4. GRANTs
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON production_cost_items TO authenticated;

-- ------------------------------------------------------------
-- 5. SEED — valores do Excel da Maria (2026-05)
-- ------------------------------------------------------------
INSERT INTO production_cost_items (kind, size_key, frame_type, glass_type, cost, position) VALUES
  -- 30x40 (A3)
  ('frame', '30x40',      'baixa',    'vidro_vidro',  49.80, 11),
  ('frame', '30x40',      'baixa',    'vidro_cartao', 50.40, 12),
  ('frame', '30x40',      'caixa',    'vidro_vidro',  51.75, 13),
  ('frame', '30x40',      'caixa',    'vidro_cartao', 53.74, 14),
  ('frame', '30x40',      'piramide', 'vidro_vidro',  57.64, 15),
  ('frame', '30x40',      'piramide', 'vidro_cartao', 59.74, 16),
  -- 40x50
  ('frame', '40x50',      'baixa',    'vidro_vidro',  70.01, 21),
  ('frame', '40x50',      'baixa',    'vidro_cartao', 73.24, 22),
  ('frame', '40x50',      'caixa',    'vidro_vidro',  74.25, 23),
  ('frame', '40x50',      'caixa',    'vidro_cartao', 77.36, 24),
  ('frame', '40x50',      'piramide', 'vidro_vidro',  81.56, 25),
  ('frame', '40x50',      'piramide', 'vidro_cartao', 84.79, 26),
  -- 50x70
  ('frame', '50x70',      'baixa',    'vidro_vidro', 109.16, 31),
  ('frame', '50x70',      'baixa',    'vidro_cartao',114.45, 32),
  ('frame', '50x70',      'caixa',    'vidro_vidro', 114.75, 33),
  ('frame', '50x70',      'caixa',    'vidro_cartao',119.78, 34),
  ('frame', '50x70',      'piramide', 'vidro_vidro', 124.05, 35),
  ('frame', '50x70',      'piramide', 'vidro_cartao',129.34, 36),
  -- Mini-quadro extra (20x25) — extras "Quadro pequeno extra"
  ('frame', 'mini_20x25', 'baixa',    'vidro_vidro',  34.75, 41),
  ('frame', 'mini_20x25', 'baixa',    'vidro_cartao', 36.10, 42),
  ('frame', 'mini_20x25', 'caixa',    'vidro_vidro',  37.68, 43),
  ('frame', 'mini_20x25', 'caixa',    'vidro_cartao', 39.00, 44),
  ('frame', 'mini_20x25', 'piramide', 'vidro_vidro',  42.94, 45),
  ('frame', 'mini_20x25', 'piramide', 'vidro_cartao', 44.25, 46),
  -- Custo de impressão de fotografia (somado quando fundo=fotografia)
  ('photo_print', '30x40',      NULL, NULL,  6.72,  51),
  ('photo_print', '40x50',      NULL, NULL, 11.20,  52),
  ('photo_print', '50x70',      NULL, NULL, 19.60,  53),
  ('photo_print', 'mini_20x25', NULL, NULL,  0.00,  54)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 6. COLUNAS NA TABELA orders
-- ------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS pyramid_frame BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS frame_internal_type TEXT,
  ADD COLUMN IF NOT EXISTS production_cost_snapshot JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_frame_internal_type_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_frame_internal_type_check
      CHECK (frame_internal_type IS NULL OR frame_internal_type IN ('baixa', 'caixa'));
  END IF;
END $$;

COMMENT ON COLUMN orders.pyramid_frame IS
  'Cliente escolheu moldura pirâmide (upgrade pago). Aplica suplemento ao orçamento e usa frame_type=piramide nos custos de produção.';

COMMENT ON COLUMN orders.frame_internal_type IS
  'Decisão interna da FBR: moldura baixa (2x2cm) ou caixa (2x3cm). Só relevante quando pyramid_frame=false. Afecta margem, não o preço ao cliente.';

COMMENT ON COLUMN orders.production_cost_snapshot IS
  'Snapshot integral da tabela production_cost_items vigente quando a encomenda foi criada. Total calculado on-the-fly a partir dos campos da encomenda. NULL para encomendas antigas (anteriores à migração 034).';

COMMIT;
