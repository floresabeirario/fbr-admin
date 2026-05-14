-- ============================================================
-- Migration 019: Aba Finanças — secção "Competição"
-- ============================================================
-- Tabela `competitors` para registar empresas concorrentes (outras
-- preservadoras de flores em PT/Europa): nome, sites, localização
-- aproximada e tabela de preços para os mesmos produtos. Apenas
-- referência interna — não cruza com encomendas reais.
--
-- Permissões: padrão "admin escreve, viewer lê" (como em orders/vouchers).
-- A Ana lê para ter contexto; só os admins (António, MJ) podem editar.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS competitors (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  updated_by      UUID REFERENCES auth.users(id),

  -- Identificação
  name            TEXT NOT NULL DEFAULT '',

  -- Sites / redes (lista livre; usar primeiro elemento como "principal")
  websites        TEXT[] DEFAULT '{}' NOT NULL,

  -- Localização (texto livre; coordenadas opcionais para mapa futuro)
  location_label  TEXT,
  latitude        DECIMAL(9,6),
  longitude       DECIMAL(9,6),
  country         TEXT DEFAULT 'PT',

  -- Tabela de preços: array de { product: string, price: number,
  --   currency: 'EUR', notes: string | null }
  -- Mantida como JSONB para flexibilidade — os produtos do
  -- concorrente podem não corresponder 1:1 aos nossos.
  prices          JSONB DEFAULT '[]'::jsonb NOT NULL,

  -- Notas internas
  notes           TEXT
);

CREATE INDEX IF NOT EXISTS competitors_name_idx     ON competitors(name)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS competitors_country_idx  ON competitors(country)  WHERE deleted_at IS NULL;

-- Trigger updated_at (reusa função genérica `update_updated_at`)
DROP TRIGGER IF EXISTS competitors_updated_at ON competitors;
CREATE TRIGGER competitors_updated_at
  BEFORE UPDATE ON competitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;

-- Admins (António, MJ) escrevem tudo
DROP POLICY IF EXISTS "competitors_admins_all" ON competitors;
CREATE POLICY "competitors_admins_all" ON competitors FOR ALL
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

-- Ana (viewer) só lê
DROP POLICY IF EXISTS "competitors_viewer_select" ON competitors;
CREATE POLICY "competitors_viewer_select" ON competitors FOR SELECT
  USING (auth.jwt() ->> 'email' = 'info+ana@floresabeirario.pt');

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE OR REPLACE FUNCTION log_competitor_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('competitors', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('competitors', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('competitors', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS competitors_audit ON competitors;
CREATE TRIGGER competitors_audit
  AFTER INSERT OR UPDATE OR DELETE ON competitors
  FOR EACH ROW EXECUTE FUNCTION log_competitor_changes();

-- ============================================================
-- GRANTs (lição das migrações 003/011 — RLS sem GRANT = 42501)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON competitors TO authenticated;

COMMIT;
