-- ============================================================
-- Migration 056: Suporta consumíveis para ornamento + pendente
-- ============================================================
-- Maria pediu para acrescentar 3 colunas à tabela "Outros custos
-- recorrentes" (Finanças → Catálogo → Custos de produção):
--   - 20x25 (mini) — já tinha suporte no schema, faltava só na UI.
--   - Ornamento de Natal — novo size_key.
--   - Pendente para colar — novo size_key.
--
-- O size_key passa a ser um identificador de "produto vendável",
-- não apenas tamanho físico. O nome da coluna fica (renomear seria
-- mais invasivo do que vale a pena agora) mas o comentário esclarece.
--
-- Com esta migração, o cost_fbr criado na mig 054 fica deprecated:
-- o custo do ornamento/pendente passa a derivar dos consumíveis
-- (cliente paga preço cliente − soma de consumíveis = margem).
-- Não dropo a coluna nesta migração para manter rollback fácil; a UI
-- deixa de a referenciar.
-- ============================================================

BEGIN;

-- O CHECK constraint de size_key foi criado inline com a tabela na
-- mig 034. Precisamos de o dropar e recriar com os 2 novos valores.
-- O nome do constraint é gerado automaticamente pelo Postgres
-- (production_cost_items_size_key_check).
ALTER TABLE production_cost_items
  DROP CONSTRAINT IF EXISTS production_cost_items_size_key_check;

ALTER TABLE production_cost_items
  ADD CONSTRAINT production_cost_items_size_key_check
  CHECK (size_key IN (
    '30x40',
    '40x50',
    '50x70',
    'mini_20x25',
    'christmas_ornament',
    'necklace_pendant'
  ));

COMMENT ON COLUMN production_cost_items.size_key IS
  'Identificador do produto vendável. Inclui tamanhos físicos (30x40, 40x50, 50x70, mini_20x25) e extras autónomos (christmas_ornament, necklace_pendant). Cada consumível pode ter custo distinto por produto.';

COMMIT;

-- ============================================================
-- VERIFICAÇÃO MANUAL (correr depois)
-- ============================================================
-- SELECT check_clause FROM information_schema.check_constraints
--   WHERE constraint_name='production_cost_items_size_key_check';
-- → check_clause deve conter 'christmas_ornament' e 'necklace_pendant'.
