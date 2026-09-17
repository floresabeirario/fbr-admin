-- ============================================================
-- Migration 112: Corrige as datas de pagamento herdadas da importação
-- ============================================================
-- Problema (apanhado na auditoria da sessão 174, logo a seguir à mig 111):
-- o audit_log regista também os INSERTs (trigger orders_audit, mig 001), e
-- a importação do Monday (mig 006) inseriu encomendas já pagas. O backfill
-- da mig 111 leu esses INSERTs como "transição de 0% para pago" e carimbou
-- deposit/second/fully_paid_at com a DATA DA IMPORTAÇÃO. Resultado: a
-- receita de todas as encomendas importadas cairia no mês da importação,
-- em vez de na data do evento (a única aproximação honesta que temos).
--
-- Regra: um carimbo que coincide com o created_at da encomenda (± 2 min)
-- numa encomenda criada ANTES do formulário público existir (1.º
-- consent_at) não é uma data de pagamento real → volta a NULL, e o código
-- cai na data do evento, como antes da 111. Transições posteriores reais
-- (ex.: importada a 30% e depois marcada 100% no admin) mantêm-se.
-- Encomendas criadas depois do formulário existir não são tocadas: aí
-- "paga no momento da criação" é plausível (Maria regista um pedido do
-- WhatsApp já com sinal).
--
-- Idempotente. Sem schema, sem GRANTs. O trigger da mig 111 só carimba
-- quando o payment_status muda, por isso este UPDATE não re-carimba nada.
-- ============================================================

BEGIN;

WITH golive AS (
  SELECT MIN(consent_at) AS at FROM orders WHERE consent_at IS NOT NULL
)
UPDATE orders o
   SET deposit_paid_at = CASE
         WHEN o.deposit_paid_at IS NOT NULL
          AND abs(extract(epoch FROM (o.deposit_paid_at - o.created_at))) < 120
         THEN NULL ELSE o.deposit_paid_at END,
       second_paid_at = CASE
         WHEN o.second_paid_at IS NOT NULL
          AND abs(extract(epoch FROM (o.second_paid_at - o.created_at))) < 120
         THEN NULL ELSE o.second_paid_at END,
       fully_paid_at = CASE
         WHEN o.fully_paid_at IS NOT NULL
          AND abs(extract(epoch FROM (o.fully_paid_at - o.created_at))) < 120
         THEN NULL ELSE o.fully_paid_at END
  FROM golive g
 WHERE (g.at IS NULL OR o.created_at < g.at)
   AND (o.deposit_paid_at IS NOT NULL OR o.second_paid_at IS NOT NULL OR o.fully_paid_at IS NOT NULL);

COMMIT;

-- ── Verificação (correr depois) ─────────────────────────────
-- 1. Encomendas anteriores ao formulário com carimbo colado ao created_at
--    (esperado: 0 depois desta migração):
-- SELECT COUNT(*)
--   FROM orders o, (SELECT MIN(consent_at) AS at FROM orders) g
--  WHERE o.created_at < g.at
--    AND (abs(extract(epoch FROM (o.deposit_paid_at - o.created_at))) < 120
--      OR abs(extract(epoch FROM (o.second_paid_at  - o.created_at))) < 120
--      OR abs(extract(epoch FROM (o.fully_paid_at   - o.created_at))) < 120);
--
-- 2. Panorama: quantas encomendas pagas têm data real de pagamento e
--    quantas caem na data do evento:
-- SELECT COUNT(*) FILTER (WHERE deposit_paid_at IS NOT NULL) AS com_data,
--        COUNT(*) FILTER (WHERE deposit_paid_at IS NULL)     AS pela_data_do_evento
--   FROM orders
--  WHERE deleted_at IS NULL AND payment_status <> '100_por_pagar';
