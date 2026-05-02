-- ============================================================
-- Fix permissões para Server Actions
-- Executar no Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- 1. generate_order_id() é usada como DEFAULT em orders.order_id.
--    Em Supabase, o role 'authenticated' precisa de EXECUTE para chamar
--    funções personalizadas durante um INSERT via PostgREST.
GRANT EXECUTE ON FUNCTION generate_order_id() TO authenticated;
GRANT EXECUTE ON FUNCTION generate_order_id() TO anon;

-- 2. update_updated_at() é usada por triggers — garantir acesso
GRANT EXECUTE ON FUNCTION update_updated_at() TO authenticated;

-- 3. O trigger log_order_changes() é SECURITY DEFINER (corre como postgres),
--    mas o INSERT em audit_log pode falhar se não houver política de INSERT.
DROP POLICY IF EXISTS "service_insert_audit" ON audit_log;
CREATE POLICY "service_insert_audit" ON audit_log
  FOR INSERT
  WITH CHECK (true);

-- 4. Garantir que orders e audit_log têm todos os grants necessários
GRANT SELECT, INSERT, UPDATE, DELETE ON orders    TO authenticated;
GRANT SELECT, INSERT                  ON audit_log TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
