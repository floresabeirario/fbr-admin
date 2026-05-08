-- ============================================================
-- FBR Admin — Fase 5: corrigir permissão para INSERT...RETURNING
-- nos formulários públicos (sessão 25, hotfix).
--
-- A migração 016 deu `GRANT INSERT` ao role `anon`, mas o cliente
-- supabase-js usa internamente `INSERT ... RETURNING` para devolver
-- o registo recém-inserido. O PostgREST avalia o RETURNING como uma
-- operação SELECT, que requer GRANT SELECT.
--
-- Sintoma observado:
--   code: '42501', message: 'permission denied for table orders'
--
-- Solução: GRANT SELECT apenas nas colunas mínimas (id, order_id /
-- code) e policies SELECT que só permitem ler registos acabados de
-- inserir (últimos 5 segundos). Não expõe PII nem dados antigos.
--
-- Executar no Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

-- ── orders ──────────────────────────────────────────────────────
-- Apenas as 2 colunas que o INSERT do form público precisa de devolver.
GRANT SELECT (id, order_id) ON orders TO anon;

-- Policy SELECT muito apertada: apenas registos criados nos últimos
-- 5 segundos. Cobre o RETURNING do INSERT e nada mais.
DROP POLICY IF EXISTS "orders_public_select_recent" ON orders;
CREATE POLICY "orders_public_select_recent" ON orders
  FOR SELECT
  TO anon
  USING (created_at >= NOW() - INTERVAL '5 seconds');

-- ── vouchers ────────────────────────────────────────────────────
-- A migração 010 já fez `GRANT SELECT ON vouchers TO anon` (sem
-- restrição de colunas) — para o site voucher.floresabeirario.pt.
-- Falta apenas a policy SELECT que cobre o RETURNING do INSERT.
DROP POLICY IF EXISTS "vouchers_public_select_recent" ON vouchers;
CREATE POLICY "vouchers_public_select_recent" ON vouchers
  FOR SELECT
  TO anon
  USING (created_at >= NOW() - INTERVAL '5 seconds');

-- ── Verificação rápida (opcional, comentada) ────────────────────
-- SELECT polname, polcmd, polroles::regrole[]
--   FROM pg_policy
--   WHERE polrelid IN ('orders'::regclass, 'vouchers'::regclass)
--   ORDER BY polrelid, polname;
