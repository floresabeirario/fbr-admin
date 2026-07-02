-- ============================================================
-- 079 — Tracking do congelador (5 dias para eliminar insectos)
-- ============================================================
-- Um dos passos do processo é congelar as flores durante 5 dias
-- para matar todos os bichinhos. A Maria quer acompanhar quais as
-- encomendas que já foram para o congelador e há quanto tempo.
-- Marcação manual no workbench (nem todas as encomendas passam
-- pelo congelador ao mesmo ritmo): "Entrou" grava freezer_in_at,
-- "Saiu" grava freezer_out_at. Só ALTER numa tabela existente,
-- sem grants novos.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS freezer_in_at  TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS freezer_out_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.freezer_in_at  IS 'Quando as flores entraram no congelador (passo de 5 dias anti-insectos)';
COMMENT ON COLUMN orders.freezer_out_at IS 'Quando as flores saíram do congelador';
