-- ============================================================
-- FBR Admin — Sessão 86: campo "detalhes" em checklist pessoal
-- ============================================================
-- Maria pediu título + detalhes em cada task (global e pessoal).
-- Tasks já tinham `description` (mig 012). Personal checklist
-- ainda não — só `text` (o título). Esta migração adiciona o
-- equivalente.
-- ============================================================

ALTER TABLE personal_checklist
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Verificação:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='personal_checklist' AND column_name='description';
-- → 1 linha.
