-- ============================================================
-- FBR Admin — Migration 040: Fechar voucher code enumeration
-- ============================================================
-- Contexto: o site voucher.floresabeirario.pt (repo fbr-voucher)
-- usa Google Sheets, NÃO o Supabase, para mostrar os vales aos
-- destinatários. Ou seja, o role `anon` no Supabase NÃO precisa
-- de ler a tabela `vouchers` para alimentar esse site.
--
-- A policy `vouchers_public_read` (mig 010) deixava qualquer
-- pessoa anónima fazer:
--   GET /rest/v1/vouchers?select=code&payment_status=eq.100_pago
-- e enumerar todos os códigos de vales pagos. Combinado com o
-- column-level GRANT da mig 038, ainda expunha código + nomes +
-- valor + mensagem + data de validade. Mesmo restrito, a lista
-- de códigos podia ser usada para fraude.
--
-- Fix: dropar a policy. Mantém-se `vouchers_public_select_recent`
-- (mig 017) que filtra por `created_at >= NOW() - 5 seconds` —
-- isto cobre o RETURNING do INSERT do form público de vale (no
-- repo fbr-website), única necessidade legítima do role anon.
--
-- A RPC `get_voucher_by_code` (mig 039) continua disponível como
-- ponte futura: se um dia o voucher.* migrar de Sheets para
-- Supabase, chama `supabase.rpc('get_voucher_by_code', { p_code })`
-- em vez de SELECT directo. Não há urgência — o vector está
-- fechado por aqui.
--
-- Executar no Supabase SQL Editor (depois de 038 e 039).
-- ============================================================

BEGIN;

-- ── Drop da policy que permitia listar vales pagos ──────────
DROP POLICY IF EXISTS "vouchers_public_read" ON vouchers;

-- Mantém-se intacto:
--   • vouchers_public_select_recent (mig 017) — 5 segundos
--     janela para RETURNING do INSERT do form público
--   • vouchers_public_insert (mig 016) — form público pode criar
--   • vouchers_admins_all (mig 009) — admins têm tudo
--   • vouchers_viewer_select (mig 009) — Ana lê

-- Notas técnicas:
-- - O column-level GRANT da mig 038 (id, code, sender_name, etc.)
--   continua a aplicar-se ao `vouchers_public_select_recent`.
-- - Sem `vouchers_public_read`, o filtro temporal é o único caminho
--   anon pode passar — e exige que o cliente acabe de inserir
--   (≤5s atrás), o que mata enumeração de vales antigos.

COMMIT;

-- ── Verificação (correr separadamente) ──────────────────────
-- 1) Confirmar que só sobram 2 policies SELECT para anon em vouchers:
-- SELECT polname, polcmd, polroles::regrole[]
--   FROM pg_policy WHERE polrelid = 'vouchers'::regclass
--     AND 'anon'::regrole = ANY(polroles)
--   ORDER BY polname;
--   -- Esperado: vouchers_public_insert (cmd=a) e
--   --           vouchers_public_select_recent (cmd=r)
--
-- 2) Confirmar que enumeration NÃO funciona (deve devolver 0 rows):
-- SET ROLE anon;
-- SELECT count(*) FROM vouchers WHERE payment_status = '100_pago';
-- RESET ROLE;
--
-- 3) RPC ainda funciona:
-- SELECT * FROM get_voucher_by_code('XXXXXX');
