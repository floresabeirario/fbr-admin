-- ============================================================
-- Migration 053: Default frame_internal_type = 'baixa'
-- ============================================================
-- Contexto:
-- A Maria pediu que o "tipo de moldura (interno)" passasse a ter
-- valor default 'baixa' (2x2cm), por ser o caso mais comum. Só
-- altera para 'caixa' (2x3cm) quando as flores são altas, ou
-- 'piramide' é controlado por `pyramid_frame` separadamente.
--
-- Sem isto, encomendas existentes têm `frame_internal_type = NULL`
-- e os custos de produção (`computeProductionCost`) não conseguem
-- calcular a moldura principal — fica "Cálculo parcial". O default
-- a 'baixa' resolve isto sem a Maria precisar de abrir uma a uma.
--
-- Não tocamos em encomendas onde `pyramid_frame = true`: nesses
-- casos a moldura interna é irrelevante (pirâmide sobrepõe-se na
-- lógica de cálculo), e manter NULL deixa claro que não se aplica.

-- 1. Backfill: encomendas com frame_internal_type NULL e sem pirâmide
UPDATE orders
SET frame_internal_type = 'baixa'
WHERE frame_internal_type IS NULL
  AND pyramid_frame = false
  AND deleted_at IS NULL;

-- 2. Default a nível da coluna para novas linhas inseridas via SQL
--    directo (ex.: seeds, scripts manuais). O código em createOrderAction
--    já aplica o mesmo default, mas isto é a segunda linha de defesa.
ALTER TABLE orders
  ALTER COLUMN frame_internal_type SET DEFAULT 'baixa';

COMMENT ON COLUMN orders.frame_internal_type IS
  'Decisão interna da FBR: moldura baixa (2x2cm, default) ou caixa (2x3cm, quando flores altas). NULL apenas em encomendas com pyramid_frame=true (irrelevante nesse caso). Afecta custo de produção, não o preço ao cliente.';
