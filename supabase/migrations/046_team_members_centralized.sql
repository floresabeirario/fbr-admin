-- ============================================================
-- Migration 046: Centralizar admins/viewers numa tabela
-- ============================================================
-- Hoje os 3 emails da equipa estão hardcoded em ~10 sítios (várias
-- policies RLS + 2 RPCs + código TS). Esta migração centraliza-os
-- numa tabela `team_members` e em duas funções SQL:
--
--   is_team_admin(email)  → TRUE se o utilizador é admin
--   is_team_member(email) → TRUE se está na equipa (admin OU viewer)
--
-- Ambas têm **fallback de segurança**: se a tabela estiver vazia ou
-- a lookup falhar, aceita os 3 emails hardcoded actuais. Isto evita
-- ficar bloqueada se algo correr mal com a tabela.
--
-- Abordagem PROGRESSIVA: só actualiza as policies de `orders` nesta
-- migração (prova de conceito). As restantes 5+ tabelas migram em
-- sessões futuras se esta funcionar bem.
--
-- Aplicação manual: Supabase Dashboard → SQL Editor → New query →
-- copiar este ficheiro inteiro → Run.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. TABELA team_members
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  email       TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
  photo       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at  TIMESTAMPTZ
);

COMMENT ON TABLE team_members IS
  'Membros da equipa FBR. Single source of truth para admin/viewer. RLS policies das outras tabelas devem usar is_team_admin() / is_team_member() em vez de listar emails directamente.';

-- Trigger genérico updated_at (já existe desde a mig 001)
DROP TRIGGER IF EXISTS team_members_updated_at ON team_members;
CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2. SEED com os 3 utilizadores actuais
-- ────────────────────────────────────────────────────────────
INSERT INTO team_members (email, name, role, photo) VALUES
  ('info+antonio@floresabeirario.pt', 'António', 'admin',  '/userphotos/antonio.webp'),
  ('info+mj@floresabeirario.pt',      'MJ',      'admin',  '/userphotos/mj.webp'),
  ('info+ana@floresabeirario.pt',     'Ana',     'viewer', '/userphotos/ana.webp')
ON CONFLICT (email) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 3. RLS na própria tabela
-- ────────────────────────────────────────────────────────────
-- Admins escrevem; todos os autenticados (incluindo Ana) lêem para
-- mostrar nomes/fotos na UI.
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_members_admins_all"           ON team_members;
DROP POLICY IF EXISTS "team_members_authenticated_select" ON team_members;

CREATE POLICY "team_members_admins_all" ON team_members FOR ALL
  TO authenticated
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

CREATE POLICY "team_members_authenticated_select" ON team_members FOR SELECT
  TO authenticated USING (deleted_at IS NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON team_members TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 4. FUNÇÃO is_team_admin(email) com fallback
-- ────────────────────────────────────────────────────────────
-- Retorna TRUE se o email é admin. Lookup primeiro à tabela; se a
-- linha não existir (ou houver problema), faz fallback para a lista
-- hardcoded actual — rede de segurança contra ficar bloqueada.
CREATE OR REPLACE FUNCTION is_team_admin(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF p_email IS NULL OR p_email = '' THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role
    FROM team_members
   WHERE email = p_email AND deleted_at IS NULL
   LIMIT 1;

  IF v_role IS NOT NULL THEN
    RETURN v_role = 'admin';
  END IF;

  -- Fallback de segurança: se a tabela falhou ou o email não está lá,
  -- continua a aceitar os admins hardcoded actuais (não bloqueia).
  RETURN p_email IN (
    'info+antonio@floresabeirario.pt',
    'info+mj@floresabeirario.pt'
  );
END;
$$;

REVOKE ALL ON FUNCTION is_team_admin(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_team_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_team_admin(TEXT) TO anon; -- para policies anon que precisem testar

-- ────────────────────────────────────────────────────────────
-- 5. FUNÇÃO is_team_member(email) com fallback
-- ────────────────────────────────────────────────────────────
-- Retorna TRUE se o email pertence à equipa (admin OU viewer).
CREATE OR REPLACE FUNCTION is_team_member(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  IF p_email IS NULL OR p_email = '' THEN
    RETURN FALSE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM team_members
     WHERE email = p_email AND deleted_at IS NULL
  ) INTO v_exists;

  IF v_exists THEN
    RETURN TRUE;
  END IF;

  RETURN p_email IN (
    'info+antonio@floresabeirario.pt',
    'info+mj@floresabeirario.pt',
    'info+ana@floresabeirario.pt'
  );
END;
$$;

REVOKE ALL ON FUNCTION is_team_member(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_team_member(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION is_team_member(TEXT) TO anon;

-- ────────────────────────────────────────────────────────────
-- 6. AUDIT LOG na tabela team_members
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_team_member_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('team_members', gen_random_uuid(), 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('team_members', gen_random_uuid(), 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('team_members', gen_random_uuid(), 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS team_members_audit ON team_members;
CREATE TRIGGER team_members_audit
  AFTER INSERT OR UPDATE OR DELETE ON team_members
  FOR EACH ROW EXECUTE FUNCTION log_team_member_changes();

-- ────────────────────────────────────────────────────────────
-- 7. POLICIES de ORDERS — primeira tabela a usar as funções
-- ────────────────────────────────────────────────────────────
-- Substitui as policies da mig 038 (`admins_all` + `viewer_select`) por
-- versões que delegam em is_team_admin() / is_team_member(). As policies
-- anon (formulário público, status público) ficam intactas — são FOR ...
-- TO anon e não dependem da equipa.

DROP POLICY IF EXISTS "admins_all"    ON orders;
DROP POLICY IF EXISTS "viewer_select" ON orders;

CREATE POLICY "admins_all" ON orders FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "viewer_select" ON orders FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email'));

COMMIT;

-- ============================================================
-- VERIFICAÇÕES RÁPIDAS (correr separadamente após a migração)
-- ============================================================
--
-- 1) Confirmar tabela seed:
-- SELECT email, name, role FROM team_members ORDER BY email;
-- → 3 linhas: António admin, MJ admin, Ana viewer
--
-- 2) Confirmar que as funções funcionam:
-- SELECT is_team_admin('info+antonio@floresabeirario.pt'); -- TRUE
-- SELECT is_team_admin('info+ana@floresabeirario.pt');     -- FALSE
-- SELECT is_team_admin('outro@gmail.com');                 -- FALSE
-- SELECT is_team_member('info+ana@floresabeirario.pt');    -- TRUE
-- SELECT is_team_member('outro@gmail.com');                -- FALSE
--
-- 3) Confirmar que o fallback funciona (apagar a linha do António,
--    confirmar que is_team_admin ainda devolve TRUE, depois RESTAURAR):
-- UPDATE team_members SET deleted_at = now() WHERE email = 'info+antonio@floresabeirario.pt';
-- SELECT is_team_admin('info+antonio@floresabeirario.pt'); -- TRUE (fallback)
-- UPDATE team_members SET deleted_at = NULL WHERE email = 'info+antonio@floresabeirario.pt';
--
-- 4) Confirmar policies de orders:
-- SELECT polname, polcmd FROM pg_policy
--  WHERE polrelid='orders'::regclass
--  ORDER BY polname;
-- → deve incluir admins_all, viewer_select, mais policies anon antigas
--
-- 5) Smoke (na app): António/MJ continuam a poder editar encomendas;
--    Ana continua a ver mas não a editar. Form público continua a aceitar
--    INSERTs (policies TO anon não foram tocadas).
-- ============================================================
