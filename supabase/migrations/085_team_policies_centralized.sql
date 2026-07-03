-- ============================================================
-- Migration 085: TODAS as policies passam a usar is_team_admin/member
-- ============================================================
-- Item 3 da auditoria da sessão 124. A mig 046 criou a tabela
-- team_members + funções is_team_admin()/is_team_member() como prova
-- de conceito (só converteu orders) e nunca mais foram adoptadas: as
-- 20+ migrações seguintes voltaram a hardcodar os 3 emails. Esta
-- migração termina o trabalho: TODAS as policies de equipa delegam
-- nas funções. A partir daqui, mudar um papel ou adicionar um membro
-- é 1 UPDATE/INSERT em team_members — sem tocar em policies.
--
-- As funções têm fallback para os 3 emails actuais (rede de segurança
-- da 046: se a tabela falhar, ninguém fica bloqueado) e são SECURITY
-- DEFINER (podem ler team_members por dentro das policies sem
-- recursão). Por segurança, esta migração re-cria as funções e o seed
-- (idempotente) — funciona quer a 046 tenha corrido quer não.
--
-- Também aperta 4 policies antigas de SELECT que eram USING(true)
-- para qualquer autenticado (system_settings, message_templates,
-- team_members, task_templates) e o INSERT do audit_log: passam a
-- exigir is_team_member. Com os signups fechados isto é redundante,
-- mas é defesa em profundidade barata.
--
-- Policies anon (sites públicos de status/voucher) NÃO são tocadas.
-- checklist_owner_all e chat "author = email" mantêm a sua lógica.
--
-- Aplicação manual: Supabase Dashboard → SQL Editor → New query →
-- colar este ficheiro inteiro → Run.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 0. Fundações (idempotente — igual à mig 046)
-- ────────────────────────────────────────────────────────────
INSERT INTO team_members (email, name, role, photo) VALUES
  ('info+antonio@floresabeirario.pt', 'António', 'admin',  '/userphotos/antonio.webp'),
  ('info+mj@floresabeirario.pt',      'MJ',      'admin',  '/userphotos/mj.webp'),
  ('info+ana@floresabeirario.pt',     'Ana',     'viewer', '/userphotos/ana.webp')
ON CONFLICT (email) DO NOTHING;

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

  -- Fallback de segurança: nunca bloquear os admins actuais.
  RETURN p_email IN (
    'info+antonio@floresabeirario.pt',
    'info+mj@floresabeirario.pt'
  );
END;
$$;

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

REVOKE ALL ON FUNCTION is_team_admin(TEXT)  FROM PUBLIC;
REVOKE ALL ON FUNCTION is_team_member(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_team_admin(TEXT)  TO authenticated, anon;
GRANT EXECUTE ON FUNCTION is_team_member(TEXT) TO authenticated, anon;

-- ────────────────────────────────────────────────────────────
-- 1. ORDERS (re-aplica a 046 — inofensivo se já estiver assim)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_all"    ON orders;
DROP POLICY IF EXISTS "viewer_select" ON orders;

CREATE POLICY "admins_all" ON orders FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "viewer_select" ON orders FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email'));

-- ────────────────────────────────────────────────────────────
-- 2. VOUCHERS (mig 009)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "vouchers_admins_all"    ON vouchers;
DROP POLICY IF EXISTS "vouchers_viewer_select" ON vouchers;

CREATE POLICY "vouchers_admins_all" ON vouchers FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "vouchers_viewer_select" ON vouchers FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email'));

-- ────────────────────────────────────────────────────────────
-- 3. PUBLIC_STATUS_SETTINGS (mig 005)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_all_settings"  ON public_status_settings;
DROP POLICY IF EXISTS "viewer_read_settings" ON public_status_settings;

CREATE POLICY "admins_all_settings" ON public_status_settings FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "viewer_read_settings" ON public_status_settings FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email'));

-- ────────────────────────────────────────────────────────────
-- 4. AUDIT_LOG (migs 038/039)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_read_audit" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert"  ON audit_log;

CREATE POLICY "admins_read_audit" ON audit_log FOR SELECT
  TO authenticated
  USING (is_team_admin(auth.jwt() ->> 'email'));

-- Antes era WITH CHECK (true) para qualquer autenticado; agora só a
-- equipa (os triggers de audit correm com a sessão de quem escreve).
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (is_team_member(auth.jwt() ->> 'email'));

-- ────────────────────────────────────────────────────────────
-- 5. TASKS + PERSONAL_CHECKLIST (mig 012)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tasks_team_all" ON tasks;

CREATE POLICY "tasks_team_all" ON tasks FOR ALL
  TO authenticated
  USING      (is_team_member(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_member(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "checklist_admins_all" ON personal_checklist;

CREATE POLICY "checklist_admins_all" ON personal_checklist FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

-- "checklist_owner_all" (owner_email = email) mantém-se intacta.

-- ────────────────────────────────────────────────────────────
-- 6. PARTNERS (mig 013)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "partners_all_users" ON partners;

CREATE POLICY "partners_all_users" ON partners FOR ALL
  TO authenticated
  USING      (is_team_member(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_member(auth.jwt() ->> 'email'));

-- ────────────────────────────────────────────────────────────
-- 7. COMPETITORS (mig 019)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "competitors_admins_all"    ON competitors;
DROP POLICY IF EXISTS "competitors_viewer_select" ON competitors;

CREATE POLICY "competitors_admins_all" ON competitors FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "competitors_viewer_select" ON competitors FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email'));

-- ────────────────────────────────────────────────────────────
-- 8. GOOGLE_INTEGRATION (mig 022)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "google_integration_admins_all" ON google_integration;

CREATE POLICY "google_integration_admins_all" ON google_integration FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

-- ────────────────────────────────────────────────────────────
-- 9. PRICING_ITEMS (mig 025)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pricing_items_admins_all"    ON pricing_items;
DROP POLICY IF EXISTS "pricing_items_viewer_select" ON pricing_items;

CREATE POLICY "pricing_items_admins_all" ON pricing_items FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "pricing_items_viewer_select" ON pricing_items FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email'));

-- ────────────────────────────────────────────────────────────
-- 10. IDEAS (mig 026) + RECIPES (mig 028) + PUBLIC_FIGURES (mig 070)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ideas_all_users" ON ideas;

CREATE POLICY "ideas_all_users" ON ideas FOR ALL
  TO authenticated
  USING      (is_team_member(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_member(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "recipes_all_users" ON recipes;

CREATE POLICY "recipes_all_users" ON recipes FOR ALL
  TO authenticated
  USING      (is_team_member(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_member(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "public_figures_all_users" ON public_figures;

CREATE POLICY "public_figures_all_users" ON public_figures FOR ALL
  TO authenticated
  USING      (is_team_member(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_member(auth.jwt() ->> 'email'));

-- ────────────────────────────────────────────────────────────
-- 11. CHAT_MESSAGES (mig 029) — mantém a lógica de autor
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chat_messages_read"       ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_insert"     ON chat_messages;
DROP POLICY IF EXISTS "chat_messages_update_own" ON chat_messages;

CREATE POLICY "chat_messages_read" ON chat_messages FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email'));

CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    is_team_member(auth.jwt() ->> 'email')
    AND author_email = auth.jwt() ->> 'email'
  );

CREATE POLICY "chat_messages_update_own" ON chat_messages FOR UPDATE
  TO authenticated
  USING (
    author_email = auth.jwt() ->> 'email'
    AND is_team_member(auth.jwt() ->> 'email')
  );

-- ────────────────────────────────────────────────────────────
-- 12. EXPENSES (mig 030)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "expenses_admin_all"   ON expenses;
DROP POLICY IF EXISTS "expenses_viewer_read" ON expenses;

CREATE POLICY "expenses_admin_all" ON expenses FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "expenses_viewer_read" ON expenses FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email'));

-- ────────────────────────────────────────────────────────────
-- 13. PRODUCTION_COST_ITEMS (mig 034)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "production_cost_items_admins_all"    ON production_cost_items;
DROP POLICY IF EXISTS "production_cost_items_viewer_select" ON production_cost_items;

CREATE POLICY "production_cost_items_admins_all" ON production_cost_items FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "production_cost_items_viewer_select" ON production_cost_items FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email'));

-- ────────────────────────────────────────────────────────────
-- 14. SYSTEM_SETTINGS + MESSAGE_TEMPLATES (mig 041)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "system_settings_admins_all"           ON system_settings;
DROP POLICY IF EXISTS "system_settings_authenticated_select" ON system_settings;

CREATE POLICY "system_settings_admins_all" ON system_settings FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "system_settings_authenticated_select" ON system_settings FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "message_templates_admins_all"           ON message_templates;
DROP POLICY IF EXISTS "message_templates_authenticated_select" ON message_templates;

CREATE POLICY "message_templates_admins_all" ON message_templates FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "message_templates_authenticated_select" ON message_templates FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email') AND deleted_at IS NULL);

-- ────────────────────────────────────────────────────────────
-- 15. TEAM_MEMBERS (mig 046) — as funções são SECURITY DEFINER,
--     por isso podem ler a própria tabela sem recursão
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "team_members_admins_all"           ON team_members;
DROP POLICY IF EXISTS "team_members_authenticated_select" ON team_members;

CREATE POLICY "team_members_admins_all" ON team_members FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "team_members_authenticated_select" ON team_members FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email') AND deleted_at IS NULL);

-- ────────────────────────────────────────────────────────────
-- 16. TASK_TEMPLATES (mig 052)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "task_templates_admins_all"           ON task_templates;
DROP POLICY IF EXISTS "task_templates_authenticated_select" ON task_templates;

CREATE POLICY "task_templates_admins_all" ON task_templates FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "task_templates_authenticated_select" ON task_templates FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email') AND deleted_at IS NULL);

-- ────────────────────────────────────────────────────────────
-- 17. WHATSAPP (mig 061)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "whatsapp_conversations_admins_all" ON whatsapp_conversations;
DROP POLICY IF EXISTS "whatsapp_conversations_team_read"  ON whatsapp_conversations;

CREATE POLICY "whatsapp_conversations_admins_all" ON whatsapp_conversations FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "whatsapp_conversations_team_read" ON whatsapp_conversations FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "whatsapp_messages_admins_all" ON whatsapp_messages;
DROP POLICY IF EXISTS "whatsapp_messages_team_read"  ON whatsapp_messages;

CREATE POLICY "whatsapp_messages_admins_all" ON whatsapp_messages FOR ALL
  TO authenticated
  USING      (is_team_admin(auth.jwt() ->> 'email'))
  WITH CHECK (is_team_admin(auth.jwt() ->> 'email'));

CREATE POLICY "whatsapp_messages_team_read" ON whatsapp_messages FOR SELECT
  TO authenticated
  USING (is_team_member(auth.jwt() ->> 'email'));

-- ────────────────────────────────────────────────────────────
-- 18. CLAUDE_USAGE (mig 067)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "claude_usage_admins_read" ON claude_usage;

CREATE POLICY "claude_usage_admins_read" ON claude_usage FOR SELECT
  TO authenticated
  USING (is_team_admin(auth.jwt() ->> 'email'));

COMMIT;

-- ── Verificação rápida (correr separadamente) ───────────────────
-- 1) Nenhuma policy deve ter emails hardcoded (excepto o fallback
--    DENTRO das funções, que é intencional):
-- SELECT c.relname AS tabela, p.polname
--   FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
--  WHERE pg_get_expr(p.polqual, p.polrelid) LIKE '%floresabeirario%'
--     OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%floresabeirario%';
-- (deve devolver 0 linhas)
-- 2) As funções respondem bem:
-- SELECT is_team_admin('info+mj@floresabeirario.pt'),   -- true
--        is_team_admin('info+ana@floresabeirario.pt'),  -- false
--        is_team_member('info+ana@floresabeirario.pt'), -- true
--        is_team_member('intruso@example.com');         -- false
