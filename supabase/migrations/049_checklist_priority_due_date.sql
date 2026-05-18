-- ============================================================
-- FBR Admin — Mig 049: prioridade + data na checklist pessoal
-- Executar no Supabase SQL Editor
-- ============================================================
-- Sessão 83: paridade visual com afazeres globais. A checklist
-- pessoal passa a poder ter priority (baixa/media/alta/urgente)
-- e due_date opcional, igual ao tasks. NÃO ganha assignee — fica
-- sempre 1 dono.
-- ============================================================

ALTER TABLE personal_checklist
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'media'
    CHECK (priority IN ('baixa', 'media', 'alta', 'urgente'));

ALTER TABLE personal_checklist
  ADD COLUMN IF NOT EXISTS due_date DATE;

CREATE INDEX IF NOT EXISTS personal_checklist_due_date_idx
  ON personal_checklist(due_date)
  WHERE deleted_at IS NULL AND done = false;

-- Verificação:
--   SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_name='personal_checklist' AND column_name IN ('priority','due_date');
--   → 2 linhas
