-- 096_templates_pre_reserva_indeciso_vaga.sql
-- Afinações às duas templates de pré-reserva "tamanho ainda por escolher"
-- (PT `pre_reserva_tamanho_indeciso_pt` + EN `_en`):
--   1. Acrescenta a frase de disponibilidade ("ainda temos vaga para a data")
--      que já existe nas templates de "tamanho escolhido", para paridade.
--   2. Troca os valores fixos (300€ / 90€ / 120€) por variáveis
--      ({valor_quadro}, {valor_sinal}, {valor_2a_parcela}, {valor_3a_parcela})
--      para que um desconto no orçamento (ex.: desconto de família) ou uma
--      futura mudança de preço se reflictam automaticamente na mensagem.
--      (O motor passou a usar o orçamento editável como base — ver
--      src/lib/templates.ts; o "30x40 cm" fica literal por ser o tamanho
--      de referência do quadro mais pequeno, não o tamanho do cliente.)
--   3. Acrescenta à versão EN o parágrafo "Once the booking is confirmed…"
--      que só existia na PT (paridade PT<->EN).
--
-- Corpo definido por inteiro (idempotente: correr N vezes deixa o mesmo texto).
-- Dollar-quoting $tpl$ como na mig 080 (apóstrofos EN ficam literais).

UPDATE message_templates
   SET body = $tpl${saudacao} {nome} 🌸

Muito obrigada por ter preenchido o formulário!

Recebemos a sua resposta e agradecemos imenso a sua confiança. 💐

Informamos também que ainda temos vaga para a data de {data_evento_extenso}.

Como ainda não decidiu o tamanho do quadro, neste momento, para reservarmos a data, o sinal corresponde a 30% do valor do quadro mais pequeno (30x40 cm, {valor_quadro}), ou seja, {valor_sinal}. Mais tarde, quando souber o tamanho concreto que prefere, se optar por um quadro maior, basta calcularmos a diferença.

Pode levar o tempo que precisar, muitos clientes preferem escolher o tamanho depois das flores estarem preservadas, para conseguirmos perceber qual o formato que melhor valoriza a composição.

O plano de pagamentos é o seguinte:
- 30% ({valor_sinal}) para reservar a data
- 40% ({valor_2a_parcela}) após receção das flores
- 30% ({valor_3a_parcela}) na conclusão do quadro, antes da entrega

Após a confirmação da reserva, alinharemos todos os detalhes da entrega das flores, para que as possamos receber o mais rapidamente possível e garantir a melhor preservação.

Aqui ficam os dados para o pagamento do sinal:
{dados_pagamento}

Depois de efetuar o pagamento, agradecemos que nos envie o comprovativo. Caso pretenda a emissão de fatura com contribuinte, pode enviar-nos o NIF.

Se quiser, teremos todo o gosto em falar consigo por telefone, seja para esclarecer qualquer dúvida ou simplesmente para nos conhecermos 😊

Mais uma vez, muito obrigada pela confiança! 🌺$tpl$
 WHERE slug = 'pre_reserva_tamanho_indeciso_pt';

UPDATE message_templates
   SET body = $tpl$Dear {nome} 🌷

Thank you so much for filling in our pre-booking form!

We have received your response and truly appreciate your trust in our work 💐

We are also happy to let you know that we still have availability for your date, {data_evento_extenso_en}.

As you haven't yet decided on the frame size, to secure your date, the booking deposit corresponds to 30% of the smallest frame (30x40 cm, {valor_quadro}), which is {valor_sinal}. Later on, once you've chosen your preferred size, if you decide on a larger frame, we will simply calculate the difference.

You can take your time to decide, many clients prefer to choose the size after the flowers have been preserved, so we can better understand which format suits your floral composition best.

The payment plan is as follows:
- 30% ({valor_sinal}) to secure the date
- 40% ({valor_2a_parcela}) upon receiving the flowers
- 30% ({valor_3a_parcela}) upon completion of the frame, before delivery

Once the booking is confirmed, we will arrange all the details of the flower delivery, so we can receive them as soon as possible and ensure the best preservation.

Here are the payment details for the deposit:
{dados_pagamento}

Once the payment has been made, we kindly ask you to send us the proof of payment. If you would like an invoice with your tax number, please feel free to share your details with us.

Once again, thank you so much for your trust 🌺$tpl$
 WHERE slug = 'pre_reserva_tamanho_indeciso_en';

-- ── Verificação (correr à mão depois) ────────────────────────────────────────
-- SELECT slug,
--        body LIKE '%vaga para a data%' OR body LIKE '%still have availability%' AS tem_vaga,
--        body LIKE '%{valor_sinal}%'  AS usa_variavel_sinal,
--        body NOT LIKE '%(90€)%'      AS sem_90_fixo
--   FROM message_templates
--  WHERE slug IN ('pre_reserva_tamanho_indeciso_pt','pre_reserva_tamanho_indeciso_en');
-- Esperado: as 3 colunas a TRUE nas duas linhas.
