-- ============================================================
-- FBR Admin — Migration 038: Endurecimento de segurança (hardening)
-- ============================================================
-- Esta migração resolve 3 vulnerabilidades identificadas numa
-- auditoria de segurança em 2026-05-16:
--
--   1) [CRÍTICO] `orders.authenticated_all` (mig 002) permitia que
--      qualquer utilizador autenticado fizesse INSERT/UPDATE/DELETE
--      directamente via PostgREST, ignorando o `requireAdmin()` das
--      server actions. Resultado: a Ana (viewer) podia, em teoria,
--      apagar encomendas chamando o endpoint Supabase directamente.
--      → Restauramos o split admin/viewer da mig 001.
--
--   2) [CRÍTICO] `vouchers` tinha `GRANT SELECT` (todas as colunas)
--      para `anon`. Combinado com a policy `vouchers_public_read`
--      (filtra por payment_status=100_pago), permitia a qualquer
--      visitante anónimo fazer scraping da tabela inteira e ler
--      sender_email, sender_phone, consent_ip, NIF, etc. de TODOS
--      os vales pagos.
--      → Reduzimos a column-level GRANT (apenas o que o site
--        voucher.floresabeirario.pt precisa de mostrar).
--
--   3) [MÉDIO] `audit_log.authenticated_read_audit` (mig 002)
--      permitia que a Ana (viewer) lesse o histórico completo de
--      alterações, incluindo valores financeiros e PII de clientes.
--      → Restringimos SELECT em audit_log a admins (António, MJ).
--
-- Executar no Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

BEGIN;

-- ── 1. orders: restaurar split admin/viewer ─────────────────────
-- A mig 002 substituiu admins_all+viewer_select por authenticated_all,
-- supostamente "para simplificar". Mas a distinção é necessária:
-- a Ana é viewer e não deve poder escrever em orders.
-- (As policies anon de mig 016/017/020 ficam intactas — são FOR ... TO anon.)

DROP POLICY IF EXISTS "authenticated_all" ON orders;
DROP POLICY IF EXISTS "admins_all"        ON orders;
DROP POLICY IF EXISTS "viewer_select"     ON orders;

CREATE POLICY "admins_all" ON orders FOR ALL
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

CREATE POLICY "viewer_select" ON orders FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' = 'info+ana@floresabeirario.pt'
  );

-- ── 2. audit_log: SELECT restrito a admins ──────────────────────
-- O audit log expõe todos os valores antigos e novos de orders,
-- vouchers, partners, tasks, etc. — incluindo NIF, orçamentos,
-- comissões, mensagens privadas. A Ana não precisa de o ver.

DROP POLICY IF EXISTS "authenticated_read_audit" ON audit_log;
DROP POLICY IF EXISTS "admins_read_audit"        ON audit_log;

CREATE POLICY "admins_read_audit" ON audit_log FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt'
    )
  );

-- ── 3. vouchers: column-level GRANT para anon ───────────────────
-- Antes: GRANT SELECT ON vouchers TO anon (todas as colunas).
-- Depois: apenas as colunas que o site voucher.floresabeirario.pt
-- precisa de mostrar. Tudo o resto (emails, telefones, consent_ip,
-- NIF, factura, comments, how_found_fbr, form_language, send_status,
-- usage_status, scheduled_send_date, delivery_*, created_by, etc.)
-- deixa de estar exposto.

REVOKE SELECT ON vouchers FROM anon;

GRANT SELECT (
  -- Necessárias para o RETURNING do INSERT do form público
  -- (policy "vouchers_public_select_recent" da mig 017)
  id,

  -- Necessárias para o site voucher.floresabeirario.pt mostrar o vale
  code,
  sender_name,
  recipient_name,
  amount,
  message,
  expiry_date,

  -- Necessárias para as policies filtrarem (USING clauses)
  payment_status,
  deleted_at,
  created_at
) ON vouchers TO anon;

-- Notas:
-- - Os admins (role authenticated) continuam a ter SELECT completo
--   via `vouchers_admins_all` (mig 009) + GRANT em mig 003.
-- - Se o site voucher.floresabeirario.pt mostrar algum campo extra
--   no futuro (ex.: needs_invoice), adicionar aqui.

COMMIT;

-- ── Verificação rápida (correr separadamente) ───────────────────
-- 1) Confirmar que orders tem admins_all + viewer_select + as anon policies:
-- SELECT polname, polcmd, polroles::regrole[]
--   FROM pg_policy WHERE polrelid = 'orders'::regclass
--   ORDER BY polname;
--
-- 2) Confirmar que audit_log SELECT é só admins:
-- SELECT polname, polcmd, polroles::regrole[]
--   FROM pg_policy WHERE polrelid = 'audit_log'::regclass;
--
-- 3) Confirmar colunas que anon pode ler em vouchers:
-- SELECT column_name FROM information_schema.column_privileges
--   WHERE table_name = 'vouchers' AND grantee = 'anon'
--   ORDER BY column_name;
--
-- Se aparecerem colunas que NÃO deviam estar lá (sender_email, nif,
-- consent_ip, etc.), há outra migração antiga que as reconcedeu —
-- revogar manualmente: REVOKE SELECT (col1, col2) ON vouchers FROM anon;
