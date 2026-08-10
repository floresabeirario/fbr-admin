-- ============================================================
-- 098 — Novo service_type 'recriacao' (Recriação)
-- ============================================================
-- A "recriação" é um serviço que a Maria carimba À MÃO numa encomenda:
-- as clientes preenchem o MESMO form de preservação (a encomenda entra
-- como 'preservacao'), e no admin a Maria muda o service_type para
-- 'recriacao' para as identificar internamente — tal como o filtro/badge
-- das flores secas, mas sem nada no site público.
--
-- Decisões (Maria, sessão desta migração):
--   • Preços IGUAIS aos da preservação (300/400/500€) — NÃO se criam
--     preços 'recriacao_*'. src/lib/pricing.ts só usa prefixo próprio para
--     'emoldurar_secas'; tudo o resto (incl. recriacao) usa a base normal.
--   • Acompanhamento público IGUAL à preservação (passa pela prensa) —
--     NADA muda no fbr-tracking nem na RPC get_public_order_status (a mig
--     097 só esconde passos para 'emoldurar_secas').
--
-- O QUE MUDA: apenas o CHECK da coluna service_type passa a aceitar o
-- terceiro valor. Aditiva, sem backfill (encomendas antigas ficam intactas).
--
-- ROLLOUT: correr no SQL Editor antes do deploy do admin que oferece a
-- opção "Recriação" no workbench.
-- ============================================================

BEGIN;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_service_type_check;
ALTER TABLE orders ADD  CONSTRAINT orders_service_type_check
  CHECK (service_type IN ('preservacao', 'emoldurar_secas', 'recriacao'));

COMMENT ON COLUMN orders.service_type IS
  'Tipo de serviço: preservacao (default) | emoldurar_secas | recriacao. Distingue os serviços dentro da mesma tabela. recriacao é carimbada à mão no admin (mesmo form/preços/estados da preservação).';

COMMIT;

-- ── Verificação (correr depois, no SQL Editor) ──────────────
-- 1) Constraint aceita os 3 valores:
--    SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname = 'orders_service_type_check';
-- 2) (opcional) marcar uma encomenda como recriação:
--    UPDATE orders SET service_type = 'recriacao' WHERE order_id = '...';
