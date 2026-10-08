-- ============================================================
-- Migration 115: Crédito do vale-presente como linha do livro
-- ============================================================
-- Contexto (sessão 178, 08/10/2026).
--
-- O PROBLEMA
-- A receita de um vale conta no mês em que foi vendido, mas só enquanto
-- não for usado: quando a cliente marca a preservação, o vale passa a
-- `preservacao_agendada`, `voucherRevenue` zera-o, e esse dinheiro SAI
-- retroactivamente do mês da venda para passar a contar pela encomenda.
-- Ou seja, um mês já fechado muda de valor meses depois. O vale da
-- Teresa foi vendido em Julho e tirou 300€ a Julho quando foi usado.
--
-- A DECISÃO DA MARIA (08/10)
-- A receita de um vale conta **no mês em que o vale foi pago**, e fica
-- lá. É a mesma regra que ela já escolheu para as encomendas na sessão
-- 174 (o dinheiro conta quando entra) e deixa os meses fechados quietos.
-- Serve os dois casos que a preocupavam: redimido, conta uma vez no mês
-- certo; expirado sem uso, também já está contado.
--
-- Para isso a encomenda não pode voltar a contar esses euros. Hoje o
-- crédito do vale está no livro como se fosse uma transferência normal
-- (foi o que o backfill da mig 114 criou, a partir da fase), por isso
-- não há como o distinguir. Esta migração reclassifica-o.
--
-- O QUE FAZ
-- Para cada encomenda com código de vale cujo vale está 100% pago e que
-- ainda não tem linha de vale: cria a linha `method='vale'` com o valor
-- creditado e REDUZ as linhas existentes do mesmo montante, da mais
-- antiga para a mais recente. O total de cada encomenda (amount_paid)
-- NÃO muda: só se reclassifica parte dele.
--   Exemplo real: Ana Isabel, orçamento 540€, vale de 400€ e 540€ no
--   livro → passa a ter 400€ de vale + 140€ de transferência.
--
-- Depois disto, `revenueInPeriod` passa a excluir as linhas de vale (o
-- dinheiro já contou no vale) e `voucherRevenue` deixa de zerar os vales
-- usados. `amount_paid` continua a incluí-las, porque o vale PAGA mesmo
-- a encomenda e ela não pode aparecer em dívida.
--
-- ⚠️ MUDA MESES JÁ FECHADOS: a receita dos 4 vales volta aos meses em
-- que foram vendidos (Maio +600€, Julho +300€, Agosto +400€) e sai das
-- encomendas. Correr no início de um mês, com o deploy do código a
-- seguir (a migração sozinha não duplica nada: enquanto o código novo
-- não estiver live, as linhas de vale continuam a contar como receita da
-- encomenda e os vales continuam zerados, exactamente como hoje).
--
-- Sem tabelas novas → sem GRANTs novos. Idempotente: a guarda é "esta
-- encomenda ainda não tem linha de vale".
-- ============================================================

BEGIN;

DO $$
DECLARE
  o        RECORD;
  pay      RECORD;
  v_credit NUMERIC;
  v_rest   NUMERIC;
  v_take   NUMERIC;
BEGIN
  FOR o IN
    SELECT ord.id,
           ord.budget,
           upper(ord.gift_voucher_code) AS code,
           v.amount     AS vale_amount,
           v.created_at AS vale_at
      FROM orders ord
      JOIN vouchers v ON upper(v.code) = upper(ord.gift_voucher_code)
     WHERE ord.deleted_at IS NULL
       AND ord.gift_voucher_code IS NOT NULL
       AND v.deleted_at IS NULL
       AND v.payment_status = '100_pago'
       AND NOT EXISTS (
         SELECT 1 FROM order_payments p
          WHERE p.order_id = ord.id AND p.method = 'vale'
       )
  LOOP
    -- O vale nunca credita mais do que o orçamento da encomenda; o que
    -- sobra fica como crédito da cliente e vive no texto das mensagens
    -- ({credito_vale}), não aqui.
    v_credit := LEAST(o.vale_amount, COALESCE(o.budget, o.vale_amount));
    CONTINUE WHEN v_credit IS NULL OR v_credit <= 0;

    -- Reduz as linhas já existentes no mesmo montante, para o total da
    -- encomenda ficar igual: isto é uma reclassificação, não dinheiro novo.
    v_rest := v_credit;
    FOR pay IN
      SELECT id, amount
        FROM order_payments
       WHERE order_id = o.id AND amount > 0 AND method <> 'vale'
       ORDER BY paid_at, created_at
    LOOP
      EXIT WHEN v_rest <= 0;
      v_take := LEAST(pay.amount, v_rest);
      IF v_take >= pay.amount THEN
        DELETE FROM order_payments WHERE id = pay.id;
      ELSE
        UPDATE order_payments SET amount = amount - v_take WHERE id = pay.id;
      END IF;
      v_rest := v_rest - v_take;
    END LOOP;

    INSERT INTO order_payments
      (order_id, amount, paid_at, method, voucher_code, is_estimated, note)
    VALUES
      (o.id, v_credit, o.vale_at::date, 'vale', o.code, true,
       'Crédito do vale-presente (mig 115)');
  END LOOP;
END $$;

COMMIT;

-- ── Verificação (correr depois) ─────────────────────────────
-- 1. As linhas de vale criadas, e o total de cada encomenda a bater com
--    o orçamento (a reclassificação não pode ter mexido no total):
-- SELECT o.client_name, o.order_id, o.budget, o.amount_paid,
--        p.amount AS credito_do_vale, p.voucher_code, p.paid_at
--   FROM order_payments p
--   JOIN orders o ON o.id = p.order_id
--  WHERE p.method = 'vale'
--  ORDER BY p.paid_at;
--
-- 2. Nenhuma encomenda pode ter ficado com o total trocado (dá 0 linhas):
-- SELECT o.order_id, o.budget, o.amount_paid
--   FROM orders o
--  WHERE o.deleted_at IS NULL
--    AND o.gift_voucher_code IS NOT NULL
--    AND o.payment_status = '100_pago'
--    AND o.budget IS NOT NULL
--    AND abs(o.amount_paid - o.budget) > 0.01;
--
-- 3. Smoke do automatismo (depois do deploy): numa encomenda de teste,
--    meter o código de um vale pago no workbench e ver a linha de vale
--    aparecer sozinha; tirar o código e vê-la desaparecer.
