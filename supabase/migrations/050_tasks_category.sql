-- ============================================================
-- FBR Admin — Sessão 85: categoria em afazeres globais (tasks)
-- ============================================================
-- Maria pediu para agrupar visualmente as tarefas globais em 6
-- categorias: packaging, flores, presença online, estúdio,
-- administrativo e outros. Default = "outros" (fallback seguro
-- para tarefas existentes e para quem criar sem escolher).
-- ============================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'outros'
  CHECK (category IN (
    'packaging',
    'flores',
    'presenca_online',
    'estudio',
    'administrativo',
    'outros'
  ));

-- Index parcial para ordenação por categoria nas listas (só tarefas
-- vivas e não feitas — que é o caso 99% do tempo na UI).
CREATE INDEX IF NOT EXISTS tasks_category_idx
  ON tasks(category)
  WHERE deleted_at IS NULL AND done = false;

-- ============================================================
-- Verificação (correr no SQL Editor depois de aplicar):
-- ============================================================
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_name='tasks' AND column_name='category';
-- → 1 linha, default 'outros'
--
-- SELECT category, count(*) FROM tasks
--   WHERE deleted_at IS NULL GROUP BY category;
-- → todas as tarefas existentes em 'outros'
