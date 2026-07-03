-- ============================================================
-- Migration 084: Fechar o INSERT anónimo (forms passam a service role)
-- ============================================================
-- Auditoria da sessão 124, item 2b. Até aqui os forms do site
-- escreviam em orders/vouchers com a ANON KEY (pública por definição).
-- O Turnstile/honeypot/rate-limit viviam só na rota do site — quem
-- falasse directamente com o PostgREST contornava tudo e podia
-- inserir encomendas/vales falsos à vontade.
--
-- O site (fbr-website) passou a escrever com a SERVICE_ROLE_KEY nas
-- rotas de servidor (app/_lib/supabase-server.js), por isso o anon
-- deixa de precisar de INSERT. As leituras públicas dos sites de
-- status e voucher (policies das migs 010/020/038/076) ficam INTACTAS.
--
-- ⚠️ ORDEM OBRIGATÓRIA — correr esta migração SÓ DEPOIS de:
--   1. adicionar a env var SUPABASE_SERVICE_ROLE_KEY ao projecto
--      fbr-website na Vercel (Settings → Environment Variables);
--   2. fazer deploy do site com o código novo (merge develop→main).
--   Se correr antes, os formulários do site PARTEM (o fallback anon
--   deixa de conseguir inserir).
--
-- Verificação pós-migração: abrir floresabeirario.pt/api/health —
-- deve devolver ok:true (o teste de escrita usa o caminho novo).
-- ============================================================

BEGIN;

-- ── 1. Policies de INSERT anon (migs 016) ───────────────────────
DROP POLICY IF EXISTS "orders_public_insert"   ON orders;
DROP POLICY IF EXISTS "vouchers_public_insert" ON vouchers;

-- ── 2. Policies de SELECT "recente" (mig 017) ───────────────────
-- Existiam só para o RETURNING dos INSERTs anon (ler id/order_id da
-- linha acabada de criar). Sem INSERT anon, deixam de fazer sentido.
-- (As policies orders_public_status_read / vouchers_public_read,
-- que alimentam os sites públicos, NÃO são tocadas.)
DROP POLICY IF EXISTS "orders_public_select_recent"   ON orders;
DROP POLICY IF EXISTS "vouchers_public_select_recent" ON vouchers;

-- ── 3. GRANTs de INSERT ─────────────────────────────────────────
REVOKE INSERT ON orders    FROM anon;
REVOKE INSERT ON vouchers  FROM anon;
-- audit_log: o anon só tinha INSERT porque o trigger de audit corria
-- nos INSERTs anon (mig 016). service_role tem o seu GRANT (mig 068).
REVOKE INSERT ON audit_log FROM anon;

-- ── 4. Funções que o anon só usava para inserir ─────────────────
REVOKE EXECUTE ON FUNCTION generate_order_id()    FROM anon;
REVOKE EXECUTE ON FUNCTION generate_voucher_code() FROM anon;
REVOKE EXECUTE ON FUNCTION update_updated_at()     FROM anon;

-- ── 5. Limpeza dos sentinelas do /api/health do site ────────────
-- A mig 077 deu EXECUTE a anon+authenticated. O health passa a
-- escrever com service_role, que NÃO estava no grant (o revoke da
-- 077 tirou o default PUBLIC).
GRANT EXECUTE ON FUNCTION public.cleanup_form_healthchecks() TO service_role;
REVOKE EXECUTE ON FUNCTION public.cleanup_form_healthchecks() FROM anon;

COMMIT;

-- ── Verificação rápida (correr separadamente) ───────────────────
-- 1) Não deve haver policies de INSERT para anon:
-- SELECT polname FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
--   WHERE c.relname IN ('orders','vouchers') AND p.polcmd = 'a';
-- 2) anon sem INSERT:
-- SELECT table_name, privilege_type FROM information_schema.table_privileges
--   WHERE grantee = 'anon' AND table_name IN ('orders','vouchers','audit_log');
-- (deve mostrar apenas SELECT em orders/vouchers)
