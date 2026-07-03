-- ============================================================
-- Migration 089: Lembrete pontual (data+hora) nas tarefas
-- ============================================================
-- "Lembra-me a esta data e hora": ao criar/editar uma tarefa pode
-- definir-se um lembrete com hora certa. Disparado por um cron externo
-- (GitHub Actions, ~10 em 10 min) porque o cron do plano Hobby da Vercel
-- só corre 1×/dia. reminder_sent_at marca que já foi enviado (não repete);
-- é reposto a NULL quando o lembrete muda (para voltar a disparar).
--
-- Aplicação manual: Supabase Dashboard → SQL Editor → colar → Run.
-- ============================================================

BEGIN;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_at      TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN tasks.reminder_at IS
  'Lembrete pontual (data+hora) da tarefa; disparado pelo cron de lembretes (/api/cron/reminders, GitHub Actions ~10min).';
COMMENT ON COLUMN tasks.reminder_sent_at IS
  'Quando o lembrete foi enviado (NULL = por enviar). Reposto a NULL quando reminder_at muda.';

-- O cron de lembretes corre como service_role: lê as tarefas com lembrete
-- por disparar e marca reminder_sent_at. Garante o GRANT (idempotente).
GRANT SELECT, UPDATE ON tasks TO service_role;

COMMIT;
