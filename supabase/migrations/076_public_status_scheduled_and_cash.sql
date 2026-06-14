-- ============================================================
-- FBR Admin — Sessão 115: link de status para clientes que pagam
-- em DINHEIRO à entrega
-- ============================================================
-- Problema: alguns clientes (sobretudo casamentos, com muito
-- dinheiro vivo das prendas) combinam pagar em mão quando vêm
-- entregar as flores. A Maria precisa de enviar o link de
-- acompanhamento na mesma — mas a policy da mig 020 só expõe
-- encomendas com pelo menos 1 pagamento parcial
-- (`payment_status <> '100_por_pagar'`), por isso o link dava
-- "não encontrado" para quem ainda não pagou nada.
--
-- Decisão da Maria (opção B): o link passa a funcionar assim que
-- a encomenda sai da pré-reserva inicial — ou seja, a partir do
-- estado "Entrega agendada" (entrega_flores_agendar é o único
-- estado de pré-reserva / fase pública 0). Continua escondida
-- enquanto estiver em "Entrega de flores por agendar" sem pagamento,
-- para não expor pré-reservas frias.
--
-- Mais: marcador interno `cash_on_delivery` para a Maria registar
-- que aquela encomenda vai ser paga em dinheiro à entrega (assim
-- sabe porque é que está agendada sem pagamento mas com link activo).
--
-- Executar no Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- ============================================================

-- ── 1. Marcador interno "pagamento em dinheiro à entrega" ───────
-- Campo ADMIN, nunca exposto ao anon (não entra no GRANT da mig 020).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cash_on_delivery BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN orders.cash_on_delivery IS
  'Cliente vai pagar em dinheiro à entrega das flores. Marcador interno; não afecta receita nem é exposto no site público.';

-- ── 2. Policy SELECT do site público — alargada ─────────────────
-- Antes (mig 020): só encomendas com algum pagamento.
-- Agora: pagamento OU estado já passou da pré-reserva inicial.
-- `entrega_flores_agendar` = fase pública 0 (pré-timeline); qualquer
-- outro estado significa que a encomenda foi agendada/avançou.
DROP POLICY IF EXISTS "orders_public_status_read" ON orders;
CREATE POLICY "orders_public_status_read" ON orders
  FOR SELECT
  TO anon
  USING (
    deleted_at IS NULL
    AND (
      payment_status <> '100_por_pagar'
      OR status <> 'entrega_flores_agendar'
    )
  );

-- ── 3. Verificação rápida (opcional, comentada) ─────────────────
-- A) Confirmar a policy:
-- SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr
--   FROM pg_policy WHERE polrelid = 'orders'::regclass
--     AND polname = 'orders_public_status_read';
--
-- B) Encomendas que passam a ser visíveis pelo link (agendadas sem
--    pagamento) — espelha o que o site público consegue ler:
-- SELECT order_id, client_name, status, payment_status, cash_on_delivery
--   FROM orders
--   WHERE deleted_at IS NULL
--     AND payment_status = '100_por_pagar'
--     AND status <> 'entrega_flores_agendar';
