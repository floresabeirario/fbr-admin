-- ============================================================
-- Migration 028: Aba "Livro de Receitas 👩‍🍳"
-- ============================================================
-- Tabela `recipes` para registar o "how-to" da preservação por
-- tipo de flor. Wiki interno colaborativo entre os 3 utilizadores.
-- Cada receita pode ter fotos (URLs no Drive), passos numerados,
-- tempo de prensa, observações, e revisões ao longo do tempo.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS recipes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  created_by_email TEXT,
  updated_by      UUID REFERENCES auth.users(id),

  flower_name     TEXT NOT NULL,           -- ex.: "Rosa", "Peónia", "Silvestres"
  scientific_name TEXT,                    -- ex.: "Rosa damascena"
  difficulty      TEXT NOT NULL DEFAULT 'media' CHECK (difficulty IN (
    'facil', 'media', 'dificil', 'experimental'
  )),
  -- Tempo de prensa típico (em dias)
  press_days_min  INTEGER,
  press_days_max  INTEGER,
  -- Conteúdo principal
  intro           TEXT,                    -- breve apresentação da flor / particularidades
  steps           JSONB DEFAULT '[]'::jsonb NOT NULL,  -- [{order, title, body, photo_url?}]
  observations    TEXT,                    -- notas, cuidados, erros comuns
  photos          JSONB DEFAULT '[]'::jsonb NOT NULL,  -- [{url, caption?}]
  related_orders  JSONB DEFAULT '[]'::jsonb NOT NULL   -- [order_id] (referência a encomendas que usaram esta flor)
);

CREATE INDEX IF NOT EXISTS recipes_flower_name_idx ON recipes(flower_name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS recipes_difficulty_idx ON recipes(difficulty) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS recipes_updated_at ON recipes;
CREATE TRIGGER recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY — todos os 3 utilizadores escrevem
-- (igual ao padrão de `ideas` e `tasks`: viewer também edita)
-- ============================================================
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipes_all_users" ON recipes;
CREATE POLICY "recipes_all_users" ON recipes FOR ALL
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt',
      'info+ana@floresabeirario.pt'
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt',
      'info+ana@floresabeirario.pt'
    )
  );

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE OR REPLACE FUNCTION log_recipe_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('recipes', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('recipes', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('recipes', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS recipes_audit ON recipes;
CREATE TRIGGER recipes_audit
  AFTER INSERT OR UPDATE OR DELETE ON recipes
  FOR EACH ROW EXECUTE FUNCTION log_recipe_changes();

-- ============================================================
-- GRANTs
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON recipes TO authenticated;

COMMIT;
