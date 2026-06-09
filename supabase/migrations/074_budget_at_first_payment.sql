-- ============================================================
-- Migration 074: Acerto de pagamento quando o orçamento sobe depois do sinal
-- ============================================================
-- Contexto (sessão 110):
-- Quando o tamanho da moldura ainda não foi escolhido, o orçamento usa a
-- 30x40 (300€) como referência provisória (lógica em src/lib/pricing.ts).
-- O cliente paga o sinal (ex.: 30% × 300€ = 90€). Mais tarde, na fase de
-- design, decide o tamanho final (ex.: 50x70 = 500€) e o orçamento sobe.
--
-- Como os pagamentos são guardados em PERCENTAGEM (30/70/100) e não em
-- euros, a mesma "% paga" passa a valer mais do que o cliente entregou →
-- buraco silencioso. Para o apanhar, guardamos o orçamento (em €) no
-- momento do 1º pagamento. O workbench compara com o orçamento actual e
-- avisa quanto pedir de diferença (lógica em src/lib/budget-adjustment.ts).
--
-- Esta migração:
--   1. orders.budget_at_first_payment — âncora em € do 1º pagamento.
--   2. 2 templates (PT + EN) "reajuste_pagamento_tamanho" para a Maria
--      copiar a mensagem do reajuste (modelados numa mensagem real dela).
--
-- Só ALTER/INSERT em tabelas existentes → sem tabelas novas, sem grants
-- novos (project_supabase_public_grants_2026 não se aplica).
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. orders.budget_at_first_payment
-- ────────────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS budget_at_first_payment NUMERIC(10,2);

COMMENT ON COLUMN orders.budget_at_first_payment IS
  'Valor do orçamento (€) no momento do 1.º pagamento do cliente. Âncora para detectar que o orçamento subiu depois do sinal (tamanho da moldura decidido na fase de design) e avisar para pedir a diferença. NULL = sem pagamento ainda ou encomenda antiga.';

-- ────────────────────────────────────────────────────────────
-- 2. Templates de mensagem (PT + EN) — reajuste de pagamento
-- ────────────────────────────────────────────────────────────
-- Variáveis: {saudacao}, {nome}, {tamanho_quadro}, {valor_total},
--            {sinal_pago}, {valor_em_falta}, {valor_3a_parcela},
--            {dados_pagamento}.
-- Sugeridos na fase de design (flores na prensa → aprovação).
INSERT INTO message_templates
  (slug, name, language, category, scope, position, is_seed, suggested_statuses, body) VALUES

('reajuste_pagamento_tamanho_pt',
 'Pagamento — reajuste após escolha do tamanho',
 'pt', 'preservacao', 'order', 82, true,
 '["flores_na_prensa","reconstrucao_botanica","a_compor_design","a_aguardar_aprovacao"]'::jsonb,
$$Bom dia, {nome} 🌷

As flores já estão na prensa. São absolutamente lindíssimas. 🤍

Inicialmente, foi pago o valor de {sinal_pago}, correspondente ao sinal sobre o quadro mais pequeno (30x40 cm).
Como optou pelo quadro de {tamanho_quadro} ({valor_total}), os valores ajustam-se. Subtraindo o que já foi pago, o valor em falta para esta etapa (70% do total) é de {valor_em_falta}.
Os restantes 30% ({valor_3a_parcela}) serão pagos quando toda a encomenda estiver finalizada, antes da entrega.

Aqui ficam os dados para pagamento:
{dados_pagamento}

Após o pagamento, agradecemos que nos envie o comprovativo. Se pretender fatura com contribuinte, pode também enviar-nos o NIF.

Obrigada 🤍
Muitas felicidades 🌸$$),

('reajuste_pagamento_tamanho_en',
 'Payment — adjustment after size is chosen',
 'en', 'preservacao', 'order', 83, true,
 '["flores_na_prensa","reconstrucao_botanica","a_compor_design","a_aguardar_aprovacao"]'::jsonb,
$$Good morning, {nome} 🌷

Your flowers are now in the press. They are absolutely beautiful. 🤍

Initially, {sinal_pago} was paid as the deposit, based on the smallest frame (30x40 cm).
As you chose the {tamanho_quadro} ({valor_total}) frame, the amounts adjust accordingly. Subtracting what has already been paid, the amount due at this stage (70% of the total) is {valor_em_falta}.
The remaining 30% ({valor_3a_parcela}) will be paid once the whole order is complete, before delivery.

Here are the payment details:
{dados_pagamento}

After payment, we would be grateful if you could send us the proof of payment. If you would like an invoice with a tax number, you can also send us your NIF.

Thank you 🤍
Wishing you all the best 🌸$$)

ON CONFLICT DO NOTHING;

COMMIT;

-- ============================================================
-- Verificações rápidas (correr depois da migração):
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='orders' AND column_name='budget_at_first_payment';
--   -- 1 linha
--
--   SELECT slug, language FROM message_templates
--    WHERE slug LIKE 'reajuste_pagamento_tamanho%';
--   -- reajuste_pagamento_tamanho_pt / reajuste_pagamento_tamanho_en
-- ============================================================
