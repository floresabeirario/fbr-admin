-- ============================================================
-- Fix definitivo das políticas RLS
-- Executar no Supabase SQL Editor → New query → Run
-- ============================================================

-- Limpar todas as políticas existentes
DROP POLICY IF EXISTS "admins_all"        ON orders;
DROP POLICY IF EXISTS "viewer_select"     ON orders;
DROP POLICY IF EXISTS "admins_read_audit" ON audit_log;

-- Política simples: qualquer utilizador autenticado pode aceder
-- (só existem 3 utilizadores no projecto — todos devem ter acesso)
CREATE POLICY "authenticated_all" ON orders
  FOR ALL
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_read_audit" ON audit_log
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Confirmar que RLS está activo
ALTER TABLE orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
