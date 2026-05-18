-- ============================================================
-- Migration 047: orders.seen_by + RPC mark_order_seen
-- ============================================================
-- Sessão 81: a bolinha de notificação ao lado de "Preservação de
-- Flores" na sidebar e o badge "Nova" da tabela passam a ser
-- per-user (lida/não lida) em vez da heurística de 24h global.
-- Quando um utilizador abre o workbench da encomenda pela 1ª vez,
-- o seu email é appended a seen_by[].
--
-- Mesmo padrão que tasks.seen_by + mark_tasks_seen (mig 044).
-- ============================================================

BEGIN;

-- ── 1. Adicionar seen_by ─────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS seen_by TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: encomendas pré-existentes ficam marcadas como vistas
-- pelos 3 utilizadores conhecidos. Sem isto, no primeiro login
-- depois desta migração, todas as encomendas históricas pareciam
-- "novas" — não é o que queremos.
UPDATE orders
   SET seen_by = ARRAY[
         'info+antonio@floresabeirario.pt',
         'info+mj@floresabeirario.pt',
         'info+ana@floresabeirario.pt'
       ]
 WHERE cardinality(seen_by) = 0;

-- ── 2. RPC mark_order_seen ───────────────────────────────────
-- SECURITY DEFINER porque tem de bypassar a RLS de UPDATE (admin-only)
-- para deixar a Ana (viewer) também "marcar como lida" para si.
CREATE OR REPLACE FUNCTION mark_order_seen(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  user_email := auth.jwt() ->> 'email';

  IF user_email IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF user_email NOT IN (
    'info+antonio@floresabeirario.pt',
    'info+mj@floresabeirario.pt',
    'info+ana@floresabeirario.pt'
  ) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF p_order_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE orders
     SET seen_by = array_append(seen_by, user_email)
   WHERE id = p_order_id
     AND NOT (user_email = ANY(seen_by));
END;
$$;

REVOKE ALL ON FUNCTION mark_order_seen(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_order_seen(uuid) TO authenticated;

COMMIT;

-- ============================================================
-- Verificações rápidas (correr depois da migração):
--
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_name='orders' AND column_name='seen_by';
--   -- 1 linha, ARRAY
--
--   SELECT count(*) FILTER (WHERE cardinality(seen_by) > 0) AS marked,
--          count(*) FILTER (WHERE cardinality(seen_by) = 0) AS not_marked
--     FROM orders;
--   -- "marked" deve ser igual ao total; "not_marked" = 0
--
--   -- Testar a RPC (com sessão de utilizador autenticado):
--   SELECT id FROM orders LIMIT 1;
--   -- copia o uuid e:
--   SELECT mark_order_seen('<uuid>');
--   SELECT seen_by FROM orders WHERE id='<uuid>';
-- ============================================================
