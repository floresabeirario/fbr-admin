-- ============================================================
-- FBR Admin — Migration 039: Endurecimento adicional (parte 2)
-- ============================================================
-- Sequência da mig 038. Foca-se em 2 melhorias rápidas:
--
--   1) audit_log: revogar INSERT directo do role `anon`.
--      Anteriormente (mig 016) demos `GRANT INSERT ON audit_log TO anon`
--      assumindo que o trigger `log_order_changes` precisava disso.
--      Não precisa — esse trigger é SECURITY DEFINER (corre como
--      `postgres`, que bypassa RLS+GRANTs). Manter o GRANT permitia
--      a qualquer pessoa anónima fazer POST /rest/v1/audit_log com
--      payload arbitrário (spam, poluição forense).
--      → REVOKE INSERT FROM anon + policy só para authenticated.
--
--   2) `get_voucher_by_code(code)` RPC.
--      Preparação para mitigar enumeration dos códigos. Hoje o site
--      voucher.floresabeirario.pt faz SELECT directo na tabela; um
--      atacante pode listar todos os códigos com:
--         GET /rest/v1/vouchers?select=code&payment_status=eq.100_pago
--      Esta função permite a transição para uma RPC que só devolve
--      o vale pedido pelo código (não lista). Não revoga ainda o
--      SELECT directo — isso fica para uma migração futura, depois
--      do site voucher.* ser actualizado para usar a RPC.
--
-- Executar no Supabase SQL Editor.
-- ============================================================

BEGIN;

-- ── 1. audit_log: bloquear INSERT directo do anon ───────────────
-- Os triggers SECURITY DEFINER (log_order_changes, log_voucher_changes,
-- log_partner_changes, log_task_changes, log_pricing_changes, etc.)
-- continuam a funcionar porque correm como o owner (`postgres`),
-- que tem BYPASSRLS em Supabase.

REVOKE INSERT ON audit_log FROM anon;

DROP POLICY IF EXISTS "service_insert_audit" ON audit_log;
DROP POLICY IF EXISTS "audit_log_insert"     ON audit_log;

-- Só authenticated pode fazer INSERT directo (necessário porque os
-- admins/viewer fazem UPDATE em orders/vouchers/etc. e isso dispara
-- triggers que inserem em audit_log; também necessário para o
-- background dos triggers SECURITY DEFINER quando o caller é
-- authenticated, dependendo da configuração do Postgres).
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── 2. RPC pública para lookup de vale ─────────────────────────
-- Devolve no máximo 1 linha. Filtra por code (uppercase),
-- não-arquivado e pago. Não expõe o resto das colunas (emails,
-- telefones, IPs RGPD, NIF, etc.).

CREATE OR REPLACE FUNCTION get_voucher_by_code(p_code TEXT)
RETURNS TABLE (
  id            UUID,
  code          TEXT,
  sender_name   TEXT,
  recipient_name TEXT,
  amount        DECIMAL,
  message       TEXT,
  expiry_date   DATE
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.code,
    v.sender_name,
    v.recipient_name,
    v.amount,
    v.message,
    v.expiry_date
  FROM vouchers v
  WHERE v.code = upper(p_code)
    AND v.deleted_at IS NULL
    AND v.payment_status = '100_pago'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_voucher_by_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_voucher_by_code(TEXT) TO authenticated;

COMMENT ON FUNCTION get_voucher_by_code(TEXT) IS
  'Lookup público de um vale pelo código. Devolve apenas as 7 colunas que voucher.floresabeirario.pt precisa de mostrar; previne enumeration (atacante já não consegue listar todos os códigos).';

COMMIT;

-- ── Verificações (correr separadamente) ────────────────────────
-- 1) Confirmar que anon JÁ NÃO tem INSERT em audit_log:
-- SELECT grantee, privilege_type FROM information_schema.table_privileges
--   WHERE table_name = 'audit_log' AND grantee = 'anon';
--   -- (não devem aparecer linhas com privilege_type='INSERT')
--
-- 2) Testar a RPC do voucher (substituir CODE por um código real):
-- SELECT * FROM get_voucher_by_code('XXXXXX');
--
-- 3) Confirmar GRANT EXECUTE:
-- SELECT grantee FROM information_schema.routine_privileges
--   WHERE routine_name = 'get_voucher_by_code';
--   -- deve mostrar anon + authenticated
