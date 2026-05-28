-- ============================================================
-- FBR Admin — Sessão 92: estado da tarefa (status GTD-style)
-- ============================================================
-- Maria pediu na sessão 92 — distinção visual entre tarefas
-- que ainda não comecei, que escolhi para hoje, e que estou a
-- fazer agora. Inspiração: kanban do Bitrix24.
--
-- 'done' continua separado (checkbox marca/desmarca a tarefa
-- como feita). 'status' aplica-se a tarefas activas.
-- Default 'por_comecar' faz sentido como ponto de partida.
-- ============================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'por_comecar'
  CHECK (status IN (
    'por_comecar',
    'a_fazer_hoje',
    'em_curso'
  ));

-- Index parcial para queries futuras (ex.: "tudo o que está em curso")
-- — apenas tarefas vivas e não concluídas.
CREATE INDEX IF NOT EXISTS tasks_status_idx
  ON tasks(status)
  WHERE deleted_at IS NULL AND done = false;

-- ============================================================
-- Verificação (correr no SQL Editor depois de aplicar):
-- ============================================================
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name='tasks' AND column_name='status';
-- → 1 linha, default 'por_comecar'
--
-- SELECT status, count(*) FROM tasks
--   WHERE deleted_at IS NULL GROUP BY status;
-- → todas as tarefas existentes em 'por_comecar'
