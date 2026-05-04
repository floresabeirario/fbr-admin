-- ============================================================
-- FBR Admin — Sessão 17: remover estado de pagamento "30% por pagar"
-- Executar no Supabase SQL Editor
-- ============================================================
--
-- "30% por pagar" e "70% pago" referem-se à mesma situação
-- (70% pago, 30% em dívida). Mantemos apenas "70% pago" e
-- convertemos qualquer registo existente.

-- 1. Converter registos existentes
UPDATE orders
SET payment_status = '70_pago'
WHERE payment_status = '30_por_pagar';

-- 2. Substituir o CHECK constraint
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN (
    '100_pago', '70_pago', '30_pago', '100_por_pagar'
  ));
