-- ============================================================
-- FBR Admin — Sessão 11: ajustes pós-feedback do workbench
-- Executar no Supabase SQL Editor
-- ============================================================

-- Coluna nova: detalhe livre quando o cliente escolhe "Outro" em
-- "Como conheceu a FBR".
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS how_found_fbr_other TEXT;
