-- ============================================================
-- FBR Admin — Site público status.floresabeirario.pt
-- Extende a column-level GRANT da migração 020 para incluir
-- `couple_names`, de modo a que o site `fbr-tracking` possa
-- mostrar o nome dos noivos em vez do nome da encomenda quando
-- aplicável (casamentos).
--
-- A policy `orders_public_status_read` (criada em 020) continua
-- a controlar QUAIS encomendas são visíveis (só pagas e não
-- arquivadas). Esta migração apenas acrescenta uma coluna ao
-- conjunto de campos que o role `anon` pode ler dessas linhas.
--
-- Executar no Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================

GRANT SELECT (couple_names) ON orders TO anon;

-- ── Verificação rápida (opcional, comentada) ─────────────────
-- SELECT grantee, privilege_type, column_name
--   FROM information_schema.column_privileges
--   WHERE table_name = 'orders' AND grantee = 'anon'
--   ORDER BY column_name;
