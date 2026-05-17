-- ============================================================
-- Migration 044: tasks multi-assignee + notificações (seen_by)
-- ============================================================
-- Mudanças:
--   1. tasks.assignee_email (TEXT) → tasks.assignee_emails (TEXT[])
--      Opção A da Maria: tarefa pode ter 2 (ou mais) responsáveis;
--      qualquer um pode marcar como concluída e desaparece para todos.
--   2. tasks.seen_by (TEXT[]) — emails que já viram esta atribuição.
--      Serve para a bolinha de notificação na sidebar do Dashboard
--      e para o toast inicial. Mesmo padrão que chat_messages.read_by.
--   3. RPC mark_tasks_seen(uuid[]) — função SECURITY DEFINER para
--      adicionar o email do JWT ao seen_by sem mexer noutras colunas
--      (idêntico em filosofia à RPC mark_chat_messages_read da mig 043).
--
-- Mesclar tarefas atribuídas a mim na checklist pessoal é puramente
-- client-side (não precisa schema novo).
-- ============================================================

BEGIN;

-- ── 1. Adicionar nova coluna assignee_emails ─────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS assignee_emails TEXT[] NOT NULL DEFAULT '{}';

-- Backfill: assignee_email único → array de 1 elemento
UPDATE tasks
   SET assignee_emails = ARRAY[assignee_email]
 WHERE assignee_email IS NOT NULL
   AND (assignee_emails IS NULL OR cardinality(assignee_emails) = 0);

-- Remover a coluna antiga (sem backwards-compat — Vercel deploya tudo de uma vez)
DROP INDEX IF EXISTS tasks_assignee_idx;
ALTER TABLE tasks DROP COLUMN IF EXISTS assignee_email;

-- Índice GIN para membership rápida (email = ANY(assignee_emails))
CREATE INDEX IF NOT EXISTS tasks_assignee_emails_idx
  ON tasks USING GIN (assignee_emails)
  WHERE deleted_at IS NULL;

-- ── 2. Adicionar seen_by ─────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS seen_by TEXT[] NOT NULL DEFAULT '{}';

-- Tarefas pré-existentes: marcar como vistas por todos os assignees
-- (não faz sentido a Maria abrir o dashboard e ver tarefas antigas
--  como "novas" só porque acabámos de adicionar a coluna).
UPDATE tasks
   SET seen_by = assignee_emails
 WHERE cardinality(assignee_emails) > 0;

-- ── 3. RPC mark_tasks_seen ───────────────────────────────────
CREATE OR REPLACE FUNCTION mark_tasks_seen(task_ids uuid[])
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

  IF task_ids IS NULL OR array_length(task_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE tasks
     SET seen_by = array_append(seen_by, user_email)
   WHERE id = ANY(task_ids)
     AND user_email = ANY(assignee_emails)
     AND NOT (user_email = ANY(seen_by));
END;
$$;

REVOKE ALL ON FUNCTION mark_tasks_seen(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_tasks_seen(uuid[]) TO authenticated;

COMMIT;

-- ============================================================
-- Verificações rápidas (correr depois da migração):
--
--   SELECT column_name, data_type
--     FROM information_schema.columns
--    WHERE table_name='tasks' AND column_name IN ('assignee_emails','seen_by');
--   -- 2 linhas, ambas ARRAY
--
--   SELECT count(*) FROM tasks WHERE cardinality(assignee_emails) > 0;
--   -- deve dar o mesmo nº que tinhas com assignee_email IS NOT NULL antes
-- ============================================================
