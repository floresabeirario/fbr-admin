-- ============================================================
-- Migration 026: Aba Ideias Futuras
-- ============================================================
-- Tabela `ideas` para registar ideias e funcionalidades futuras
-- ordenadas por importância e tema. Todos os 3 utilizadores podem
-- contribuir (admin + viewer escrevem) — é um espaço colaborativo.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS ideas (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  created_by_email TEXT,
  updated_by      UUID REFERENCES auth.users(id),

  title           TEXT NOT NULL,
  description     TEXT,
  importance      TEXT NOT NULL DEFAULT 'media' CHECK (importance IN ('baixa', 'media', 'alta', 'critica')),
  theme           TEXT NOT NULL DEFAULT 'outro' CHECK (theme IN (
    'preservacao',
    'vale_presente',
    'parcerias',
    'financas',
    'comunicacao',
    'design',
    'tecnologia',
    'outro'
  )),
  status          TEXT NOT NULL DEFAULT 'proposta' CHECK (status IN (
    'proposta',
    'em_avaliacao',
    'planeada',
    'em_curso',
    'concluida',
    'rejeitada'
  ))
);

CREATE INDEX IF NOT EXISTS ideas_importance_idx ON ideas(importance) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ideas_theme_idx ON ideas(theme) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ideas_status_idx ON ideas(status) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS ideas_updated_at ON ideas;
CREATE TRIGGER ideas_updated_at
  BEFORE UPDATE ON ideas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY — todos os 3 utilizadores escrevem
-- ============================================================
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ideas_all_users" ON ideas;
CREATE POLICY "ideas_all_users" ON ideas FOR ALL
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
CREATE OR REPLACE FUNCTION log_idea_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('ideas', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('ideas', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('ideas', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ideas_audit ON ideas;
CREATE TRIGGER ideas_audit
  AFTER INSERT OR UPDATE OR DELETE ON ideas
  FOR EACH ROW EXECUTE FUNCTION log_idea_changes();

-- ============================================================
-- GRANTs
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON ideas TO authenticated;

-- ============================================================
-- SEED — ideias já registadas no PROGRESS.md
-- ============================================================
INSERT INTO ideas (title, description, importance, theme, status) VALUES
  (
    'Chat interno entre membros',
    'Canal de comunicação dentro da plataforma com texto, vídeo, foto e áudio. Substituir trocas avulsas por WhatsApp/email para tudo o que diz respeito à operação.',
    'media',
    'comunicacao',
    'em_avaliacao'
  ),
  (
    'Livro de Receitas 👩‍🍳',
    'Nova aba tipo wiki para registar o "how-to" da preservação por tipo de flor (rosa, peónia, silvestre, etc.). Cada receita com fotos, passos, tempo de prensa, observações. Guardar conhecimento adquirido e evitar perdê-lo.',
    'media',
    'preservacao',
    'em_avaliacao'
  ),
  (
    'Comissão condicional nas Parcerias',
    'Quando o parceiro recomendador for "Nenhum parceiro", esconder os campos Comissão (€) e Estado da comissão no workbench (ficam só ruído).',
    'baixa',
    'parcerias',
    'proposta'
  )
ON CONFLICT DO NOTHING;

COMMIT;
