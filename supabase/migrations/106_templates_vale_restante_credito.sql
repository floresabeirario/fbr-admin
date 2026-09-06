-- ============================================================
-- 106 — Vale-presente: template "reserva com restante a pagar",
--       frase do crédito que sobra, e factos novos do Cérebro do Claude
-- Sessão 160 (06/09/2026). Aprovado pela Maria (textos lidos por ela).
--
-- Contexto: o formulário do site passou a mostrar o resumo da encomenda
-- com o vale descontado. Quando o orçamento é MAIOR do que o vale, o site
-- diz "restante a pagar X, de uma só vez, em 24h"; quando é MENOR, diz
-- "ainda tem X de crédito". O único template de vale para encomendas
-- dizia sempre "coberto pelo vale". Esta migração:
--   1. cria vale_reserva_restante_pt/en (novo, nunca pisa edições dela);
--   2. acrescenta {credito_vale} ao vale_reserva_coberta_pt/en (só se a
--      frase-âncora ainda lá estiver e a variável ainda não);
--   3. junta um bloco de factos a system_settings.claude_facts (só se
--      ainda não lá estiver; nunca reescreve o que ela editou).
-- Variáveis novas (src/lib/templates.ts, mesmo deploy):
--   {codigo_vale} (agora também em encomendas), {valor_vale_desconto},
--   {valor_restante}, {credito_vale}.
-- Ordem: migração e deploy são independentes (as variáveis desconhecidas
-- ficam vazias até o deploy chegar; o template novo só aparece quando a
-- migração correr).
-- ============================================================

-- 1. Template novo: vale com restante a pagar ─────────────────
INSERT INTO message_templates
  (slug, name, language, category, scope, position, is_seed, suggested_statuses, body) VALUES

('vale_reserva_restante_pt',
 'Vale-presente: reserva com restante a pagar',
 'pt', 'vale_presente', 'order', 42, true,
 '["entrega_flores_agendar", "entrega_agendada"]'::jsonb,
$tpl${saudacao} {nome} 🌻

Muito obrigada por ter preenchido o formulário!

Recebemos a sua resposta e agradecemos imenso a sua confiança. 💐

Escolheu:

{resumo_encomenda}

O vale-presente {codigo_vale} desconta {valor_vale_desconto}, por isso o restante a pagar é {valor_restante}. Com vale-presente, este valor paga-se de uma só vez, nas próximas 24 horas, e a sua reserva fica confirmada.

Pode fazê-lo por:
{dados_pagamento}

Assim que o pagamento estiver feito, pedimos apenas que nos envie o comprovativo. Se quiser fatura, pode enviar-nos o NIF.

Em relação à entrega das flores, somos flexíveis, basta combinarmos a forma e o momento que vos forem mais convenientes.

Também poderá acompanhar o estado da sua encomenda aqui:
{link_status}

Vai ser um gosto cuidar das vossas flores. 🌸$tpl$),

('vale_reserva_restante_en',
 'Gift voucher: booking with a remaining amount to pay',
 'en', 'vale_presente', 'order', 43, true,
 '["entrega_flores_agendar", "entrega_agendada"]'::jsonb,
$tpl${saudacao} {nome} 🌻

Thank you so much for filling in the form!

We have received your answers and truly appreciate your trust. 💐

You have chosen:

{resumo_encomenda}

Your gift voucher {codigo_vale} covers {valor_vale_desconto}, so the remaining amount is {valor_restante}. With a gift voucher, this amount is paid in one go, within the next 24 hours, and your booking is then confirmed.

You can pay by:
{dados_pagamento}

Once the payment is made, please send us the receipt. If you would like an invoice, you can send us your tax number.

As for delivering the flowers, we are flexible: we simply arrange the way and the moment that suit you best.

You can also follow the status of your order here:
{link_status}

It will be a pleasure to take care of your flowers. 🌸$tpl$)

ON CONFLICT (slug) DO NOTHING;

-- 2. Crédito que sobra no template "reserva coberta" ──────────
-- A variável {credito_vale} traz as suas próprias quebras de linha e fica
-- vazia quando não sobra nada, por isso cola-se ao fim da frase.
UPDATE message_templates
   SET body = REPLACE(body,
     $old$coberto pelo vale-presente que recebeu. 🎁$old$,
     $new$coberto pelo vale-presente que recebeu. 🎁{credito_vale}$new$)
 WHERE slug = 'vale_reserva_coberta_pt'
   AND body NOT LIKE '%{credito_vale}%';

UPDATE message_templates
   SET body = REPLACE(body,
     $old$covered by the gift voucher you received. 🎁$old$,
     $new$covered by the gift voucher you received. 🎁{credito_vale}$new$)
 WHERE slug = 'vale_reserva_coberta_en'
   AND body NOT LIKE '%{credito_vale}%';

-- 3. Factos novos do Cérebro do Claude ────────────────────────
UPDATE system_settings
   SET value = value || $f$

## Actualização de Setembro de 2026 (formulário com resumo + Termos 2.0)
- Fundos do quadro: só o fundo fotografia tem custo. Cor, preto, branco e transparente estão incluídos no preço.
- Vale-presente: o valor desconta-se ao orçamento. Se sobrar, o crédito pode ir para extras da mesma encomenda e não se devolve em dinheiro. Se faltar, o restante paga-se de uma só vez (sem as três fases), nas 24 horas após a confirmação.
- Vale-presente: quem compra o vale não decide a preservação. O vale é um crédito. Tamanho, fundo, extras e aprovação da composição são de quem faz a reserva de preservação com o código do vale, normalmente a pessoa presenteada. Se quem ofereceu quiser tratar de tudo como surpresa, é essa pessoa que faz a reserva de preservação e passa a ser o cliente.
- Aprovação da composição: 72 horas para aprovar ou pedir ajustes razoáveis. Sem resposta, lembramos. Ao fim de 30 dias sem resposta, avançamos com a composição proposta.
- Reagendamento: o sinal transfere-se uma vez para a nova data, até 24 meses depois da data original, sujeito a disponibilidade.
- O cliente já viu no formulário do site um resumo com o total estimado e as fases de pagamento. O orçamento final é sempre confirmado por nós por mensagem.
- Termos e Condições 2.0 em vigor desde Setembro de 2026: https://floresabeirario.pt/termos-e-condicoes$f$
 WHERE key = 'claude_facts'
   AND value NOT LIKE '%Actualização de Setembro de 2026%';

-- ── Verificação (Maria, SQL Editor) ──────────────────────────
-- SELECT slug, position FROM message_templates WHERE slug LIKE 'vale_reserva_%' ORDER BY slug;
--   → 4 linhas: coberta_en, coberta_pt, restante_en, restante_pt
-- SELECT slug, body LIKE '%{credito_vale}%' AS tem_credito FROM message_templates WHERE slug LIKE 'vale_reserva_coberta%';
--   → tem_credito = true nas duas (se der false, a frase-âncora foi editada; acrescentar {credito_vale} à mão no editor)
-- SELECT value LIKE '%Actualização de Setembro de 2026%' FROM system_settings WHERE key = 'claude_facts';
--   → true
