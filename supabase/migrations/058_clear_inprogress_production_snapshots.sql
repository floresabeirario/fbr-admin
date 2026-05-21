-- ============================================================
-- Migration 058: Limpar production_cost_snapshot em encomendas
--                que ainda não estão 100% pagas
-- ============================================================
-- Contexto:
-- Até à sessão 91, o `production_cost_snapshot` era capturado no
-- momento da criação da encomenda (em `createOrderAction`). Para
-- reservas com evento a longo prazo (ex.: 2027), os preços dos
-- materiais podem mudar antes da produção, pelo que o snapshot
-- capturado na criação ficava desactualizado.
--
-- Decisão Maria 2026-05-22: o snapshot passa a ser capturado quando
-- a encomenda transita para `payment_status='100_pago'`, momento em
-- que o negócio "fecha" e os preços são os mais recentes que sabemos.
--
-- Esta migração limpa snapshots existentes em encomendas que ainda
-- não estão 100% pagas — esses snapshots vão ser recapturados (com
-- a tabela de custos vigente na altura) quando essas encomendas
-- transitarem para 100% pago.
--
-- Encomendas já 100% pagas mantêm o snapshot que tinham (essas
-- estão "fechadas" para efeitos de custo).
-- Encomendas canceladas ou soft-deleted ficam intocadas (sem
-- impacto financeiro, melhor preservar histórico).

UPDATE orders
SET production_cost_snapshot = NULL
WHERE payment_status <> '100_pago'
  AND status <> 'cancelado'
  AND deleted_at IS NULL
  AND production_cost_snapshot IS NOT NULL;

-- Verificação (executar manualmente após a migração):
--
--   SELECT payment_status,
--     count(*) FILTER (WHERE production_cost_snapshot IS NOT NULL) AS com_snapshot,
--     count(*) FILTER (WHERE production_cost_snapshot IS NULL) AS sem_snapshot
--   FROM orders
--   WHERE deleted_at IS NULL AND status <> 'cancelado'
--   GROUP BY payment_status
--   ORDER BY payment_status;
--
-- Esperado: linhas `30_pago`, `70_pago`, `100_por_pagar`, `30_por_pagar`
-- têm `com_snapshot = 0` (todas limpas). Só `100_pago` mantém valores.
