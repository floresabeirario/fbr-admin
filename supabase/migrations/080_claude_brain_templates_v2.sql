-- ============================================================
-- Migration 080: Cérebro do Claude v2 + Templates v2 (PT+EN)
-- ============================================================
-- Sessão 118. A Maria partilhou 37 conversas WhatsApp reais e pediu:
--   1. Melhorar/criar/eliminar templates com base nas conversas;
--   2. Paridade total PT<->EN (toda a template existe nas duas línguas);
--   3. Ensinar o Claude (persona + factos) sobre o negócio para as
--      sugestões deixarem de ser genéricas.
--
-- O que esta migração faz:
--   A. Reescreve system_settings.claude_persona (regra de língua
--      espelhada, registo, emojis, funerais, templates como fonte).
--   B. Preenche system_settings.claude_facts (estava vazio!) com o
--      conhecimento do negócio extraído das conversas reais.
--   C. Upsert de ~39 pares de templates por slug. Corrige também o
--      bug das apóstrofes duplicadas ("haven''t") que o seed 041
--      gravou dentro de $$...$$ (dollar-quoting não processa '' como
--      escape) e que apareciam nas mensagens enviadas às clientes.
--   D. Arquiva templates duplicadas (feedback_review_google_* foi
--      substituída pela pedir_opiniao_quadro_* da mig 072).
--
-- Sem tabelas novas => sem grants novos.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- A. PERSONA DO CLAUDE
-- ────────────────────────────────────────────────────────────
INSERT INTO system_settings (key, value) VALUES
('claude_persona',
$persona$És a Maria João da Flores à Beira-Rio (FBR), estúdio familiar de preservação de flores em Coimbra. Escreves mensagens de WhatsApp a clientes e leads.

LÍNGUA (regra nº 1):
- Responde SEMPRE na língua das últimas mensagens do cliente: português europeu se o cliente escreve em PT, inglês se escreve em EN.
- Se o cliente escrever noutra língua (francês, espanhol, alemão…), responde nessa língua e, na primeira interação, explica com simpatia que não a falamos, mas que usamos tradutor e que pode continuar a escrever na língua dele.
- Nunca mistures línguas na mesma mensagem.

A tua voz:
- Português europeu (nunca brasileiro).
- Calorosa mas profissional; frases claras e directas, sem enrolar.
- Tratamento por defeito: "a senhora"/"vocês"; nunca "você" explícito. Se o cliente tratar por "tu", podes espelhar esse tom mais próximo.
- Emojis florais com moderação (🌷 🌸 🌻 🪻 🏵️ 💐 🤍): normalmente 1 na saudação e 1 no fecho; nunca mais de 3-4 por mensagem.
- Estrutura habitual: saudação com o primeiro nome + emoji ("Boa tarde Ana 🌷") → corpo em parágrafos curtos → fecho disponível ("Qualquer dúvida, estamos por aqui 🌸").
- Casamentos: no primeiro contacto dá sempre os parabéns pelo casamento. Funerais: começa SEMPRE por condolências ("os nossos sentimentos pela sua perda"), tom sóbrio, emojis só 🤍 — NUNCA parabéns.
- Em inglês: warm but professional, frases simples (a Maria fala inglês mas não é fluente).
- Convite para chamada telefónica: APENAS em português — a equipa não faz chamadas em inglês.

Regras de conteúdo:
- NUNCA uses o travessão (—) nas mensagens: onde caberia um travessão, usa vírgula, dois pontos ou parêntesis. (Hífen dentro de palavras compostas é normal e mantém-se.)
- Os templates da FBR são a fonte oficial de conteúdo: quando a situação corresponde a um template, usa o template como base e adapta nomes, valores e datas ao contexto da conversa. Não inventes formulações novas para situações que os templates já resolvem.
- NUNCA inventes preços, valores de recolha, prazos, moradas ou disponibilidade que não estejam nos factos, nos templates ou na conversa. Quando faltar um dado, escreve [CONFIRMAR: o que falta] no lugar.
- Nunca prometas datas exactas de conclusão do quadro (padrão: "cerca de 6 meses").
- Depois de indicares dados de pagamento, pede sempre o comprovativo e oferece fatura com NIF.
- A tua resposta vai ser COPIADA pela Maria para o WhatsApp Business: escreve apenas o texto final a enviar, sem prefácios ("Aqui está a sugestão:") nem aspas a envolver.$persona$),

-- ────────────────────────────────────────────────────────────
-- B. FACTOS DO NEGÓCIO (estava vazio)
-- ────────────────────────────────────────────────────────────
('claude_facts',
$facts$## Quem somos
- Flores à Beira-Rio (FBR): estúdio familiar de preservação de flores por prensagem, em Coimbra (Ceira).
- Equipa: Maria João "MJ" (design e comunicação), António (marido da MJ; faz as recolhas e entregas — telemóvel pessoal 969 706 561), Ana Baião (equipa; faz as chamadas às clientes — 968 573 903). Número principal FBR/WhatsApp: 934 680 300.
- O atelier é apenas espaço de trabalho e NÃO está aberto ao público. Encontramo-nos com os clientes num ponto de fácil estacionamento na Estrada da Beira (o link do Maps segue na confirmação da reserva).

## O que fazemos (e o que não fazemos)
- Preservação por prensagem: as flores ficam bidimensionais (planas) e transformam-se numa composição artística feita pétala a pétala, emoldurada com vidro museu (protecção de longa duração).
- NÃO fazemos preservação 3D/resina — a maioria desses métodos usa químicos industriais poluentes e nocivos; explicar com simpatia quando perguntam.
- Correcção de cor incluída quando necessário (flores brancas tendem a ficar marfim/acastanhadas com o tempo).
- O design é SEMPRE aprovado pelo cliente antes de colarmos as flores; nessa fase pode pedir os ajustes que quiser.
- Podemos incorporar elementos no quadro sem custo: terço, medalhas, convite, fitas, rendas, fotografias, notas manuscritas, etiquetas do seating plan, etc.
- Votos de casamento dentro da moldura: desaconselhamos (teriam de ser colados ao vidro e nunca mais se acede); alternativa habitual = envelope discreto colado atrás do quadro, por fora.
- Também fazemos: quadros extra pequenos 20x25 cm, pendentes para colar (usamos 1 pétala/raminho ~2 cm — quase não gastam flores), ornamentos de Natal e fundo com fotografia (impressão profissional em papel de arquivo pH neutro).

## Preços (não inventar outros; na dúvida [CONFIRMAR])
- Quadros: 30x40 cm — 300€ · 40x50 cm — 400€ · 50x70 cm — 500€.
- Quadro extra pequeno 20x25 cm — 90€. Pendente para colar — 35€.
- Fundo com fotografia: +20€ num quadro 30x40.
- Moldura incluída no preço: madeira maciça 2x2 cm em três acabamentos — lacada a branco, lacada a preto ou folheada a nogueira. Moldura pirâmide: custo extra (+15€ num 20x25).
- Vale-presente: valor mínimo 300€ (corresponde ao quadro 30x40). Vale físico: +9€ + portes; o digital é gratuito.
- Ornamentos de Natal e outros extras: [CONFIRMAR: preço na tabela de Finanças].

## Plano de pagamentos
- 30% para reservar a data → 40% após a recepção das flores → 30% na conclusão do quadro, antes da entrega.
- Tamanho ainda indeciso → o sinal corresponde a 30% do quadro mais pequeno (30x40 = 90€); quando escolher, acerta-se a diferença. Muitos clientes escolhem o tamanho só depois das flores preservadas — pode levar o tempo que precisar.
- O serviço de recolha é pago por inteiro junto com o sinal.
- Aceitamos pagamento em dinheiro na entrega das flores em mãos.
- Pedir SEMPRE o comprovativo; se o cliente quiser fatura, pedir o NIF.
- MB Way só funciona em Portugal; a clientes internacionais dá-se titular + IBAN + BIC + banco.
- A reserva SÓ fica garantida com o sinal pago; até lá a disponibilidade pode mudar (lembrar com delicadeza quando passam mais de ~24h).

## Prazos
- Recebemos flores até cerca de 6 dias após o evento, dependendo do tipo de flores. Quanto mais cedo chegarem, melhor a preservação — sobretudo com calor. Nunca dizer que "já não vai a tempo" sem confirmar connosco.
- Conclusão do quadro: cerca de 6 meses (nunca prometer data exacta).
- Casa das molduras: normalmente ~1 semana, no máximo ~15 dias.

## Como nos fazem chegar as flores (3 formas)
1. Entrega em mãos em Coimbra — gratuito; recebemos todos os dias, incluindo sábados e domingos.
2. Recolha no local — em qualquer ponto do país, mediante orçamento por rota e disponibilidade. Valores já praticados: Coimbra↔Pombal 40€ · recolha local Coimbra 25€ · zona Sintra/Estoril 110€ · Coimbra↔Alverca 150€ · Coimbra↔Braga 185€ · Coimbra↔Sintra 190–195€ · Coimbra↔Amares 195€ · Coimbra↔Sesimbra 195€. Para rotas novas: pedir a morada exacta e [CONFIRMAR: valor da recolha] — NUNCA inventar. Com a recolha o cliente não trata de embalagem nem transporte: tratamos de tudo.
3. Envio por CTT/transportadora — recomendar o serviço de entrega em 1 dia útil (~15€; os CTT fecham ao fim de semana — casamentos de sexta/sábado implicam envio na segunda). Morada de envio: Maria João Brito, Rua da Beira 688, 3030-901 Tapada, Ceira, Coimbra; indicar o contacto 934 680 300 na encomenda. Guia de envio: https://www.floresabeirario.pt/enviar-flores-por-correio (EN: https://www.floresabeirario.pt/en/how-to-ship-your-flowers).

## Cuidados com as flores até chegarem a nós
- Cortar 1–2 cm dos caules; água limpa renovada todos os dias; divisão mais fresca da casa; NUNCA no frigorífico; longe do sol directo.
- Atirar o bouquet no casamento não é problema para a preservação (rosas são resistentes); quem quiser garantir o bouquet intacto pode pedir à florista um bouquet réplica para atirar.
- Flores que cheguem em mau estado: preservamos as que estiverem em condições; podemos substituir flores por iguais (via florista) — o custo da substituição fica a cargo do cliente quando a degradação se deve a atraso na entrega; quando somos nós a propor a substituição, é sem custo.

## Envio do quadro final
- Levantamento em mãos em Coimbra: gratuito. Por vezes conseguimos entregar noutras cidades aproveitando recolhas/viagens já agendadas.
- Envio nacional/internacional: embalagem de frágeis cuidada; o custo é calculado APENAS no fim (tamanho, peso e destino) — nunca dar valor fechado antes. Referências: quadro para a Europa ~100€; EUA costuma ficar +100–200€ acima da Europa e sujeito a taxas alfandegárias do destino; China praticamente inviável (recomendar morada europeia).

## Links oficiais
- Site: www.floresabeirario.pt (EN: floresabeirario.pt/en)
- Reservar: https://www.floresabeirario.pt/reservar-preservacao (EN: https://www.floresabeirario.pt/en/book-preservation)
- Oferecer / vale-presente: https://www.floresabeirario.pt/oferecer-preservacao
- Opções e preços: https://www.floresabeirario.pt/opcoes-e-precos
- Acompanhamento de encomenda: https://status.floresabeirario.pt/ + ID da encomenda
- Página do vale: https://voucher.floresabeirario.pt/ + código

## Situações recorrentes
- "Já casei, ainda vou a tempo?" → sim, se dentro de ~6 dias; transmitir urgência simpática e perguntar onde se encontra para orientar a entrega.
- Funeral → condolências primeiro, tom sóbrio, urgência delicada.
- Email enviado sem resposta → sugerir verificar a pasta de spam; oferecer continuar por WhatsApp. (Mesmo quando os clientes preferem email, o nosso email cai muitas vezes no spam — na prática o WhatsApp é o canal que funciona.)
- "É caro / não tinha noção do orçamento" → empatia, explicar o valor (processo de vários meses, vidro museu, peça única e irrepetível), desejar felicidades; NUNCA oferecer desconto.
- Cliente pergunta pelo estado da encomenda → responder com carinho, dizer em que fase está e reenviar o link de acompanhamento.
- Cliente quer ver trabalhos → enviar fotos de peças concluídas e explicar que o design é aprovado pelo cliente antes da colagem.$facts$)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ────────────────────────────────────────────────────────────
-- C. TEMPLATES v2 — upsert por slug (corpos = conversas reais)
-- ────────────────────────────────────────────────────────────
INSERT INTO message_templates
  (slug, name, language, category, scope, position, is_seed, suggested_statuses, body) VALUES

-- ═══════════ PRIMEIRO CONTACTO / LEADS ═══════════

('primeiro_contacto_info_pt',
 'Primeiro contacto: informações + link do formulário',
 'pt', 'pre_reserva', 'order', 1, true,
 '[]'::jsonb,
$tpl${saudacao} {nome} 🌷

Antes de mais, muitos parabéns pelo casamento e agradecemos o interesse no nosso trabalho.

Pode encontrar todas as informações sobre os nossos serviços de preservação de flores, incluindo preços, opções disponíveis e o processo, no nosso site:

www.floresabeirario.pt

Caso pretenda avançar com a reserva, basta preencher o nosso formulário de pré-reserva:

https://www.floresabeirario.pt/reservar-preservacao

Ficamos ao dispor para esclarecer qualquer dúvida 🌻$tpl$),

('primeiro_contacto_info_en',
 'First contact: info + booking form link',
 'en', 'pre_reserva', 'order', 2, true,
 '[]'::jsonb,
$tpl$Hello {nome} 🌷

First of all, congratulations on your wedding, and thank you so much for your interest in our work!

You can find all the information about our flower preservation services, including prices, available options and how the process works, on our website:

www.floresabeirario.pt/en

If you would like to go ahead with the booking, you just need to fill in our pre-booking form:

https://www.floresabeirario.pt/en/book-preservation

If you have any questions, we are always happy to help 🌻$tpl$),

('pos_evento_vai_a_tempo_pt',
 'Já casou: ainda vai a tempo',
 'pt', 'pre_reserva', 'order', 3, true,
 '[]'::jsonb,
$tpl${saudacao} {nome} 🌷

Antes de mais, muitos parabéns pelo casamento!

Sim, ainda vai a tempo: informamos que ainda temos disponibilidade para receber o seu bouquet 🎉

Quanto mais cedo as flores chegarem até nós, melhores serão os resultados da preservação, especialmente nesta altura de temperaturas mais elevadas.

Entretanto, mantenha o bouquet com os caules em água limpa, na divisão mais fresca da casa (sem colocar no frigorífico) e longe do sol. 💧

Onde é que se encontram? Assim podemos indicar-lhe a melhor forma de nos fazer chegar o bouquet 💐$tpl$),

('pos_evento_vai_a_tempo_en',
 'Already married: still in time',
 'en', 'pre_reserva', 'order', 4, true,
 '[]'::jsonb,
$tpl$Hello {nome} 🌷

First of all, congratulations on your wedding!

Yes, you are still in time: we still have availability to receive your bouquet 🎉

The sooner the flowers reach us, the better the preservation results tend to be, especially with the warm temperatures at this time of year.

In the meantime, please keep the bouquet with the stems in clean water, in the coolest room of your home (not in the fridge) and away from sunlight. 💧

Where are you located? That way we can suggest the best way to get the bouquet to us 💐$tpl$),

('funeral_condolencias_pt',
 'Funeral: condolências + primeiros passos',
 'pt', 'pre_reserva', 'order', 5, true,
 '["entrega_flores_agendar"]'::jsonb,
$tpl${saudacao} {nome} 🤍

Antes de mais, os nossos sentimentos pela sua perda e agradecemos a confiança no nosso trabalho para guardar uma memória tão especial.

Neste caso, o tempo é importante: quanto mais cedo as flores chegarem até nós, maiores são as probabilidades de uma boa preservação.

Pode encontrar todas as informações sobre os nossos serviços, opções e preços no nosso site:
www.floresabeirario.pt

Caso pretenda avançar, basta preencher o nosso formulário de pré-reserva e daremos seguimento com a maior brevidade:
https://www.floresabeirario.pt/reservar-preservacao

Ficamos ao dispor para esclarecer qualquer dúvida e, se preferir, também podemos falar por telefone. 🤍$tpl$),

('funeral_condolencias_en',
 'Funeral: condolences + first steps',
 'en', 'pre_reserva', 'order', 6, true,
 '["entrega_flores_agendar"]'::jsonb,
$tpl$Hello {nome} 🤍

First of all, our deepest condolences for your loss, and thank you for trusting us with such a special memory.

In this case, time matters: the sooner the flowers reach us, the better the chances of a good preservation.

You can find all the information about our services, options and prices on our website:
www.floresabeirario.pt/en

If you would like to go ahead, you just need to fill in our pre-booking form and we will follow up as quickly as possible:
https://www.floresabeirario.pt/en/book-preservation

We are here for any questions you may have. 🤍$tpl$),

-- ═══════════ PRÉ-RESERVA (form preenchido) ═══════════

('pre_reserva_tamanho_escolhido_pt',
 'Pré-reserva: tamanho escolhido',
 'pt', 'pre_reserva', 'order', 10, true,
 '["entrega_flores_agendar"]'::jsonb,
$tpl${saudacao} {nome} 🌸

Muito obrigada por ter preenchido o formulário!

Recebemos a sua resposta e agradecemos imenso a sua confiança. 💐

Informamos também que ainda temos vaga para a data de {data_evento_extenso}.

Escolheu o quadro {tamanho_quadro} ({valor_quadro}).

Para confirmar a reserva, pedimos o pagamento do sinal de 30% ({valor_sinal}).

O plano de pagamentos é o seguinte:
- 30% ({valor_sinal}) para reservar a data
- 40% ({valor_2a_parcela}) após receção das flores
- 30% ({valor_3a_parcela}) na conclusão do quadro, antes da entrega

Aqui ficam os dados para o pagamento do sinal:
{dados_pagamento}

Depois de efetuar o pagamento, agradecemos que nos envie o comprovativo. Caso pretenda a emissão de fatura com contribuinte, pode enviar-nos o NIF.

Se quiser, teremos todo o gosto em falar consigo por telefone, seja para esclarecer qualquer dúvida ou simplesmente para nos conhecermos 😊

Mais uma vez, muito obrigada pela confiança e carinho! 🌺$tpl$),

('pre_reserva_tamanho_escolhido_en',
 'Pre-booking: frame size chosen',
 'en', 'pre_reserva', 'order', 11, true,
 '["entrega_flores_agendar"]'::jsonb,
$tpl$Dear {nome} 🌸

Thank you so much for filling in our form!

We have received your response and truly appreciate your trust in our work. 💐

We are also happy to let you know that we still have availability for your date, {data_evento_extenso_en}.

You have chosen the {tamanho_quadro} frame ({valor_quadro}).

To confirm your booking, we kindly ask for a 30% deposit ({valor_sinal}).

The payment plan is as follows:
- 30% ({valor_sinal}) to book the date
- 40% ({valor_2a_parcela}) upon receipt of the flowers
- 30% ({valor_3a_parcela}) upon completion of the frame, before delivery

Here are the payment details for the deposit:
{dados_pagamento}

Once the payment has been made, we kindly ask you to send us the proof of payment. If you would like an invoice with your tax number, please feel free to share it with us.

Once again, thank you so much for your trust and kindness! 🌺$tpl$),

('pre_reserva_tamanho_indeciso_pt',
 'Pré-reserva: tamanho ainda por escolher (sinal 90€)',
 'pt', 'pre_reserva', 'order', 12, true,
 '["entrega_flores_agendar"]'::jsonb,
$tpl${saudacao} {nome} 🌸

Muito obrigada por ter preenchido o formulário!

Recebemos a sua resposta e agradecemos imenso a sua confiança. 💐

Como ainda não decidiu o tamanho do quadro, neste momento, para reservarmos a data, o sinal corresponde a 30% do valor do quadro mais pequeno (30x40 cm – 300€), ou seja, 90€. Mais tarde, quando souber o tamanho concreto que prefere, se optar por um quadro maior, basta calcularmos a diferença.

Pode levar o tempo que precisar, muitos clientes preferem escolher o tamanho depois das flores estarem preservadas, para conseguirmos perceber qual o formato que melhor valoriza a composição.

O plano de pagamentos é o seguinte:
- 30% (90€) para reservar a data
- 40% (120€) após receção das flores
- 30% (90€) na conclusão do quadro, antes da entrega

Após a confirmação da reserva, alinharemos todos os detalhes da entrega das flores, para que as possamos receber o mais rapidamente possível e garantir a melhor preservação.

Aqui ficam os dados para o pagamento do sinal:
{dados_pagamento}

Depois de efetuar o pagamento, agradecemos que nos envie o comprovativo. Caso pretenda a emissão de fatura com contribuinte, pode enviar-nos o NIF.

Se quiser, teremos todo o gosto em falar consigo por telefone, seja para esclarecer qualquer dúvida ou simplesmente para nos conhecermos 😊

Mais uma vez, muito obrigada pela confiança! 🌺$tpl$),

('pre_reserva_tamanho_indeciso_en',
 'Pre-booking: frame size undecided (90€ deposit)',
 'en', 'pre_reserva', 'order', 13, true,
 '["entrega_flores_agendar"]'::jsonb,
$tpl$Dear {nome} 🌷

Thank you so much for filling in our pre-booking form!

We have received your response and truly appreciate your trust in our work 💐

As you haven't yet decided on the frame size, to secure your date, the booking deposit corresponds to 30% of the smallest frame (30x40 cm – 300€), which is 90€. Later on, once you've chosen your preferred size, if you decide on a larger frame, we will simply calculate the difference.

You can take your time to decide, many clients prefer to choose the size after the flowers have been preserved, so we can better understand which format suits your floral composition best.

The payment plan is as follows:
- 30% (90€) to secure the date
- 40% (120€) upon receiving the flowers
- 30% (90€) upon completion of the frame, before delivery

Here are the payment details for the deposit:
{dados_pagamento}

Once the payment has been made, we kindly ask you to send us the proof of payment. If you would like an invoice with your tax number, please feel free to share your details with us.

Once again, thank you so much for your trust 🌺$tpl$),

-- ═══════════ LEMBRETES / SEGUIMENTO ═══════════

('lembrete_reserva_nao_paga_pt',
 'Lembrete: reserva ainda não confirmada',
 'pt', 'lembretes', 'order', 10, true,
 '["entrega_flores_agendar"]'::jsonb,
$tpl${saudacao} {nome} 🌸

Apenas uma pequena nota para informar que, neste momento, a sua data ainda não está reservada.

Só conseguimos garantir a reserva após o pagamento do sinal e, entretanto, a disponibilidade pode alterar-se.

Se tiver alguma dúvida ou precisar de ajuda no processo, estamos por aqui 💐$tpl$),

('lembrete_reserva_nao_paga_en',
 'Reminder: booking not yet confirmed',
 'en', 'lembretes', 'order', 11, true,
 '["entrega_flores_agendar"]'::jsonb,
$tpl$Hello {nome} 🌸

Just a quick note to let you know that, at this moment, your date is not yet reserved.

We can only secure the booking once the deposit payment is completed, and availability may change in the meantime.

If you have any questions or need any help with the process, feel free to ask 💐$tpl$),

('seguimento_sem_resposta_pt',
 'Seguimento: cliente sem resposta',
 'pt', 'lembretes', 'order', 20, true,
 '["entrega_flores_agendar"]'::jsonb,
$tpl${saudacao} {nome} 🌼

Gostaríamos apenas de confirmar se pretende avançar com a encomenda, para podermos organizar tudo do nosso lado. 💐

Se tiver alguma dúvida ou precisar de ajuda no processo, estamos por aqui 🌸$tpl$),

('seguimento_sem_resposta_en',
 'Follow-up: no reply from client',
 'en', 'lembretes', 'order', 21, true,
 '["entrega_flores_agendar"]'::jsonb,
$tpl$Hello {nome} 🌼

We would just like to confirm whether you wish to go ahead with your order, so we can organise everything on our side. 💐

If you have any questions or need any help with the process, we are here 🌸$tpl$),

-- ═══════════ ENTREGA DAS FLORES — OPÇÕES E ORÇAMENTOS ═══════════

('opcoes_entrega_flores_pt',
 'Como nos fazer chegar as flores: 3 opções',
 'pt', 'reserva', 'order', 5, true,
 '["entrega_flores_agendar", "entrega_agendada"]'::jsonb,
$tpl$O nosso estúdio fica em Coimbra, pelo que existem três formas de nos fazer chegar as flores:

💐 Entrega em mãos no nosso atelier em Coimbra (gratuito):
Recebemos flores todos os dias da semana, incluindo sábados e domingos. Esta é a opção ideal caso algum familiar ou convidado venha para a zona de Coimbra e possa trazer o bouquet.

🚗 Recolha no local:
Podemos deslocar-nos a um local à sua escolha para recolher as flores, mediante orçamento e disponibilidade.

📦 Envio por CTT/transportadora:
Enviamos instruções detalhadas para embalar e enviar o bouquet em segurança. Os CTT têm um serviço de entrega em 1 dia útil (atenção: estão fechados ao fim de semana).

Diga-nos, por favor, qual destas opções lhe seria mais conveniente 🌼$tpl$),

('opcoes_entrega_flores_en',
 'How to get the flowers to us: 3 options',
 'en', 'reserva', 'order', 6, true,
 '["entrega_flores_agendar", "entrega_agendada"]'::jsonb,
$tpl$Our studio is located in Coimbra, and there are three ways to get the flowers to us:

💐 In-person drop-off at our studio in Coimbra (free of charge):
We receive flowers every day of the week, including Saturdays and Sundays. This is the ideal option if a family member or guest is coming to the Coimbra area and can bring the bouquet.

🚗 Flower pick-up:
We can collect the flowers from a location of your choice, subject to availability and quotation.

📦 Shipping by courier/post:
We will send you detailed instructions on how to pack and ship the bouquet safely. CTT offers a 1-business-day delivery service (please note they are closed on weekends).

Let us know which option works best for you 🌼$tpl$),

('recolha_orcamento_pt',
 'Recolha: pedir morada para orçamento',
 'pt', 'reserva', 'order', 7, true,
 '["entrega_flores_agendar", "entrega_agendada"]'::jsonb,
$tpl$Para podermos calcular o valor da recolha, pode indicar-nos a morada onde iremos recolher as flores? 🌻

Com o nosso serviço de recolha não precisa de se preocupar com embalagens nem com o transporte: recolhemos o bouquet diretamente no local que indicar, no dia e à hora que vos forem mais convenientes, e tratamos de tudo para que chegue em segurança ao nosso atelier em Coimbra. 💐$tpl$),

('recolha_orcamento_en',
 'Pick-up: ask for address to quote',
 'en', 'reserva', 'order', 8, true,
 '["entrega_flores_agendar", "entrega_agendada"]'::jsonb,
$tpl$So we can calculate the pick-up fee, could you please tell us the address where we will be collecting the flowers? 🌻

With our pick-up service you don't need to worry about packaging or transportation: we collect the bouquet directly from the location you choose, on the day and at the time that suit you best, and we take care of everything so it arrives safely at our atelier in Coimbra. 💐$tpl$),

-- ═══════════ CONFIRMAÇÕES DE RESERVA ═══════════

('confirmacao_reserva_maos_pt',
 'Confirmação de reserva: entrega em mãos',
 'pt', 'reserva', 'order', 10, true,
 '["entrega_agendada"]'::jsonb,
$tpl${saudacao} {nome} 🌷

Confirmamos a receção e a sua reserva. 🎉

Segue a morada para entrega das flores:
📍 {morada_estudio}

O nosso atelier fica numa rua pequena sem acesso fácil para carros, por isso encontramo-nos convosco no ponto indicado no mapa, onde é simples parar o carro e fazer a entrega.

Quando souberem a que horas vão passar, pedimos que nos avisem antecipadamente e, novamente, quando estiverem a cerca de 10 minutos de chegar.

Até lá, mantenham o bouquet com os caules em água limpa o máximo de tempo possível, faz mesmo diferença no resultado da preservação. 💧

Também poderá acompanhar o estado da sua encomenda aqui:
{link_status}

Vai ser um gosto cuidar das vossas flores. 🌸

Qualquer dúvida, estamos disponíveis 🥰$tpl$),

('confirmacao_reserva_maos_en',
 'Booking confirmation: in-person drop-off',
 'en', 'reserva', 'order', 11, true,
 '["entrega_agendada"]'::jsonb,
$tpl$Dear {nome} 🌷

We are delighted to confirm your reservation. 🎉

Here is the address for dropping off your flowers:
📍 {morada_estudio}

Our studio is located on a small car-free street, so we will meet you at the easiest place to stop your car, which is the location provided above.

Once you know roughly what time you will be arriving, we kindly ask that you let us know in advance. Then, when you are about 10 minutes away, just send us a message so we can come up to meet you. 💐

Until then, please keep the bouquet with the stems in clean water for as long as possible, it really makes a difference to the preservation. 💧

You can also follow the progress of your order here:
{link_status}

It will be a pleasure to take care of your flowers. 🌸

If you have any questions, we are always happy to help 🤍$tpl$),

('confirmacao_reserva_ctt_pt',
 'Confirmação de reserva: envio por CTT (morada + guia)',
 'pt', 'reserva', 'order', 20, true,
 '["entrega_agendada", "flores_enviadas"]'::jsonb,
$tpl${saudacao} {nome} 🪻

Confirmamos a receção e a sua reserva. 🎉

Segue a morada para envio das flores:

📍 Rua da Beira 688
3030-901 Tapada, Ceira, Coimbra

Pode indicar o nosso número de telemóvel na encomenda nos CTT:
📞 934 680 300

Aqui encontra todas as instruções sobre como preparar e enviar as flores:
https://www.floresabeirario.pt/enviar-flores-por-correio

Recomendamos o serviço de entrega em 1 dia útil, para que as flores cheguem até nós o mais frescas possível.

Até ao momento de embalar e enviar, mantenha as flores com os caules em água limpa o máximo de tempo possível. Quanto mais hidratadas chegarem, melhor será a preservação. 💧

Também poderá acompanhar o estado da sua encomenda aqui:
{link_status}

Qualquer dúvida que surja durante o processo, estamos totalmente disponíveis para ajudar. 🌸$tpl$),

('confirmacao_reserva_ctt_en',
 'Booking confirmation: shipping by courier (address + guide)',
 'en', 'reserva', 'order', 21, true,
 '["entrega_agendada", "flores_enviadas"]'::jsonb,
$tpl$Dear {nome} 🪻

We confirm receipt and your reservation. 🎉

Here is the address for shipping the flowers:

📍 Rua da Beira 688
3030-901 Tapada, Ceira, Coimbra
Portugal

You can add our phone number to the CTT/courier shipment:
📞 +351 934 680 300

Here you will find all the instructions on how to prepare and ship the flowers safely:
https://www.floresabeirario.pt/en/how-to-ship-your-flowers

We recommend the 1-business-day delivery service, so the flowers arrive as fresh as possible.

Until it is time to pack and ship them, please keep the flowers with the stems in clean water for as long as possible. The more hydrated they arrive, the better the preservation. 💧

You can also follow the progress of your order here:
{link_status}

If any questions come up during the process, we are always available to help. 🌸$tpl$),

('ctt_enviar_hoje_pt',
 'CTT: incentivo a enviar ainda hoje',
 'pt', 'reserva', 'order', 22, true,
 '["entrega_flores_agendar", "entrega_agendada"]'::jsonb,
$tpl$Verificámos que escolheu a opção de envio das flores por CTT/transportadora.

Gostaríamos de saber se conseguiria enviar as flores ainda hoje.
Os CTT disponibilizam um serviço de entrega em 1 dia útil, pelo que, se forem enviadas hoje, deveremos recebê-las já amanhã, o que é sempre o mais benéfico para a preservação das flores. 💐$tpl$),

('ctt_enviar_hoje_en',
 'Courier: encourage shipping today',
 'en', 'reserva', 'order', 23, true,
 '["entrega_flores_agendar", "entrega_agendada"]'::jsonb,
$tpl$We noticed you chose to send the flowers by CTT/courier.

We would like to know if you could ship the flowers today.
CTT offers a 1-business-day delivery service, so if they are sent today, we should receive them tomorrow, which is always best for the preservation of the flowers. 💐$tpl$),

('confirmacao_reserva_recolha_pt',
 'Confirmação de reserva: recolha no local',
 'pt', 'reserva', 'order', 30, true,
 '["entrega_agendada"]'::jsonb,
$tpl${saudacao} {nome} 🌷

Confirmamos a receção e a sua reserva. 🎉

📍 A recolha fica agendada. Pedimos só que nos indiquem a janela horária que vos for mais conveniente.

Até à recolha, mantenham o bouquet com os caules em água limpa, na divisão mais fresca da casa (sem colocar no frigorífico) e longe do sol. 💧

Também poderá acompanhar o estado da sua encomenda aqui:
{link_status}

Vai ser um gosto cuidar das vossas flores. 🌸

Qualquer dúvida, estamos disponíveis. Se algo mudar, avisem-nos e encontraremos uma solução. 🪻$tpl$),

('confirmacao_reserva_recolha_en',
 'Booking confirmation: collection at venue',
 'en', 'reserva', 'order', 31, true,
 '["entrega_agendada"]'::jsonb,
$tpl$Hello {nome} 🌷

We confirm receipt and the reservation. 🎉

📍 The collection is scheduled. Please let us know the specific time window that is most convenient for you.

Until the collection, please keep the bouquet with the stems in clean water, in the coolest room of your home (not in the fridge) and away from sunlight. 💧

You can also track the status of your order here:
{link_status}

It will be a pleasure to take care of your flowers. 🌸

If you have any questions, we are always available. If anything changes, let us know and we will find a solution. 🪻$tpl$),

-- ═══════════ CUIDADOS + JANELA HORÁRIA ═══════════

('preparacao_flores_pt',
 'Cuidados com as flores até à entrega/recolha',
 'pt', 'reserva', 'order', 50, true,
 '["entrega_agendada"]'::jsonb,
$tpl$Não precisa de se preocupar com nada: assim que as flores estiverem connosco, tratamos de tudo.

Até lá, sugerimos apenas estes cuidados:
• Corte cerca de 1 a 2 cm dos caules e coloque as flores em água limpa (renovando a água todos os dias)
• Mantenha o ramo na divisão mais fresca da casa (sem colocar no frigorífico)
• Longe da luz solar direta

É só isso 💐😊$tpl$),

('preparacao_flores_en',
 'Flower care before drop-off/collection',
 'en', 'reserva', 'order', 51, true,
 '["entrega_agendada"]'::jsonb,
$tpl$You don't need to worry about anything: once the flowers are with us, we will take care of everything.

Until then, we just suggest these simple steps:
• Cut about 1–2 cm off the stems and keep the flowers in clean water (changing the water every day)
• Keep the bouquet in the coolest room of your home (please don't place it in the fridge)
• Away from direct sunlight

That's all 💐😊$tpl$),

('janela_horaria_pt',
 'Pedido de janela horária',
 'pt', 'reserva', 'order', 60, true,
 '["entrega_agendada"]'::jsonb,
$tpl${saudacao} {nome} 🌻

Do nosso lado somos bastante flexíveis em relação ao horário.
Pedimos apenas que, assim que tiverem uma ideia da janela horária, nos avisem para conseguirmos organizar-nos.

Qualquer coisa, estamos por aqui 🌸$tpl$),

('janela_horaria_en',
 'Time window request',
 'en', 'reserva', 'order', 61, true,
 '["entrega_agendada"]'::jsonb,
$tpl$Hello {nome} 🌻

We are very flexible with timing on our side.
We just ask that, as soon as you have an idea of the time window, you let us know so we can organise ourselves accordingly.

Anything you need, we are here 🌸$tpl$),

-- ═══════════ RECEPÇÃO DAS FLORES + 2ª PARCELA ═══════════

('recepcao_flores_2a_parcela_pt',
 'Recepção das flores + 2ª parcela (40%)',
 'pt', 'recepcao_flores', 'order', 10, true,
 '["flores_recebidas", "flores_na_prensa"]'::jsonb,
$tpl${saudacao} {nome} 🌷

As suas flores já chegaram a Coimbra e vão para a prensa! São absolutamente lindíssimas. 🤍

Nesta fase, dá-se também o pagamento da segunda parcela, correspondente a 40% do valor total: {valor_2a_parcela}.

Pode fazê-lo por:
{dados_pagamento}

Assim que o pagamento estiver feito, pedimos apenas que nos envie o comprovativo.
Se quiser fatura, pode enviar-nos o NIF.

Obrigada por nos confiar algo tão especial.
Muitas felicidades 🌸$tpl$),

('recepcao_flores_2a_parcela_en',
 'Flowers received + 2nd payment (40%)',
 'en', 'recepcao_flores', 'order', 11, true,
 '["flores_recebidas", "flores_na_prensa"]'::jsonb,
$tpl$Hello {nome} 🪻

Your flowers have safely arrived in Coimbra and they are going in the press! They are absolutely beautiful. 🤍

At this stage, the second payment is also due, corresponding to 40% of the total amount: {valor_2a_parcela}.

Here are the payment details:
{dados_pagamento}

Once the payment has been made, we kindly ask that you send us the proof of payment.
If you would like an invoice with your tax number, please let us know.

Thank you so much for trusting us with something so special, and wishing you all the happiness in the world 🌸$tpl$),

-- ═══════════ PRESERVAÇÃO / DESIGN ═══════════

('orientacao_quadro_pt',
 'Pedido de orientação do quadro',
 'pt', 'preservacao', 'order', 10, true,
 '["flores_na_prensa", "reconstrucao_botanica", "a_compor_design"]'::jsonb,
$tpl${saudacao} {nome} 🌼

Dentro das próximas duas semanas, iremos enviar-lhe a fotografia da composição do seu quadro. Depois de aprovar a composição, avançaremos para colar as flores no vidro e, de seguida, emoldurar.

Gostaria também de perguntar a sua preferência quanto à orientação do quadro: prefere que seja vertical, horizontal, ou escolhemos nós consoante o que valorize melhor a composição?

Ficamos a aguardar 🌷$tpl$),

('orientacao_quadro_en',
 'Frame orientation request',
 'en', 'preservacao', 'order', 11, true,
 '["flores_na_prensa", "reconstrucao_botanica", "a_compor_design"]'::jsonb,
$tpl$Hello {nome} 🌼

Within the next two weeks, we will send you a photo of your frame's composition. Once you approve the design, we will glue the flowers to the glass and then send it for framing.

We would also like to ask about your preference for the frame orientation: would you like it vertical, horizontal, or shall we choose whichever best enhances the composition?

We look forward to hearing from you 🌷$tpl$),

('aprovacao_design_pt',
 'Aprovação de design',
 'pt', 'aprovacao_design', 'order', 10, true,
 '["a_compor_design", "a_aguardar_aprovacao"]'::jsonb,
$tpl$Cara {nome},

Enviamos a proposta de composição do quadro!

As flores ainda não estão coladas, pedimos agora que nos confirme se está tudo do seu agrado ou se deseja algum ajuste. Esperamos que goste.

Assim que tivermos o seu "sim", colamos as flores ao vidro e mandamos emoldurar.

Ficamos a aguardar o seu feedback 🤍$tpl$),

('aprovacao_design_en',
 'Design approval',
 'en', 'aprovacao_design', 'order', 11, true,
 '["a_compor_design", "a_aguardar_aprovacao"]'::jsonb,
$tpl$Dear {nome},

We are sending you the composition proposal for your frame!

The flowers are not yet glued, so we now kindly ask you to confirm whether everything is to your liking, or if you would like any adjustments. We hope you love it.

Once we have your "yes", we will glue the flowers to the glass and send it off to be framed.

We look forward to your feedback 🤍$tpl$),

('escolha_moldura_pt',
 'Escolha da moldura',
 'pt', 'finalizacao', 'order', 5, true,
 '["a_aguardar_aprovacao", "a_finalizar_quadro", "a_ser_emoldurado"]'::jsonb,
$tpl${saudacao} {nome} 🏵️

Chegou o momento de escolher a moldura. 🖼️

Todas as molduras são feitas à medida e as opções incluídas no valor são:

• Moldura de madeira maciça, 2x2 cm, disponível em três acabamentos:
– Madeira lacada a branco
– Madeira lacada a preto
– Madeira folheada a nogueira

Envio em seguida fotografias das opções para poderem visualizar. Se preferirem, temos também a opção da moldura pirâmide, com um custo adicional.

Ficamos a aguardar a vossa escolha 🌼$tpl$),

('escolha_moldura_en',
 'Frame choice',
 'en', 'finalizacao', 'order', 6, true,
 '["a_aguardar_aprovacao", "a_finalizar_quadro", "a_ser_emoldurado"]'::jsonb,
$tpl$Hello {nome} 🏵️

It's time to choose your frame. 🖼️

All frames are custom-made, and the options included in the price are:

• Solid wood frame, 2x2 cm, available in three finishes:
– White lacquered wood
– Black lacquered wood
– Walnut veneer wood

I will send you photos of the options so you can visualise them. If you prefer, we also offer the pyramid frame option, at an additional cost.

We look forward to your choice 🌼$tpl$),

-- ═══════════ FINALIZAÇÃO / ENTREGA ═══════════

('quadro_pronto_3a_parcela_pt',
 'Quadro pronto + 3ª parcela (30%)',
 'pt', 'finalizacao', 'order', 10, true,
 '["quadro_pronto", "emoldurado"]'::jsonb,
$tpl$Cara {nome},

O quadro já está pronto 🎁💌

Informamos também que este é o momento do pagamento da terceira e última parcela (30%), no valor de {valor_3a_parcela}.

Pode fazê-lo por:
{dados_pagamento}

Assim que o pagamento estiver feito, pedimos apenas que nos envie o comprovativo.
Caso deseje fatura, pode também enviar-nos o NIF.

Qualquer questão, estamos por aqui.

Obrigada 🤍$tpl$),

('quadro_pronto_3a_parcela_en',
 'Frame ready + 3rd payment (30%)',
 'en', 'finalizacao', 'order', 11, true,
 '["quadro_pronto", "emoldurado"]'::jsonb,
$tpl$Dear {nome},

Your frame is ready 🎁💌

This is also the moment for the third and final payment (30%), corresponding to {valor_3a_parcela}.

Here are the payment details:
{dados_pagamento}

Once the payment has been made, please send us the proof of payment.
If you would like an invoice, feel free to share your tax number as well.

Any questions, we are here.

Thank you 🤍$tpl$),

-- ═══════════ PAGAMENTOS / FACTURA / OUTROS ═══════════

('confirmacao_pagamento_pt',
 'Confirmação de recepção de pagamento',
 'pt', 'outros', 'both', 5, true,
 '[]'::jsonb,
$tpl$Confirmamos a receção do pagamento. Muito obrigada! 🎉

Assim que tivermos novidades, voltamos a contactar. 💐$tpl$),

('confirmacao_pagamento_en',
 'Payment received confirmation',
 'en', 'outros', 'both', 6, true,
 '[]'::jsonb,
$tpl$We confirm receipt of your payment. Thank you so much! 🎉

As soon as we have news, we will be in touch. 💐$tpl$),

('email_spam_pt',
 'Email enviado: verificar spam / mudar para WhatsApp',
 'pt', 'outros', 'both', 10, true,
 '[]'::jsonb,
$tpl${saudacao} {nome} 🌻

Enviámos-lhe um email recentemente com as informações para dar seguimento à preservação das suas flores.
Caso não o encontre na caixa de entrada, sugerimos verificar também a pasta de spam/lixo eletrónico.

Se preferir, podemos também fazer toda a comunicação por WhatsApp.

Ficamos a aguardar. Obrigada 🌸$tpl$),

('email_spam_en',
 'Email sent: check spam / switch to WhatsApp',
 'en', 'outros', 'both', 11, true,
 '[]'::jsonb,
$tpl$Hello {nome} 🌻

We recently sent you an email with the information to move forward with the preservation of your flowers.
If you can't find it in your inbox, we suggest checking your spam/junk folder as well.

If you prefer, we can also handle all communication through WhatsApp.

We look forward to hearing from you. Thank you 🌸$tpl$),

('paciencia_processo_pt',
 'Pedido de paciência durante o processo',
 'pt', 'outros', 'order', 20, true,
 '[]'::jsonb,
$tpl$A preservação de flores requer um processo delicado e feito com muito cuidado em cada etapa, por isso agradecemos muito a vossa paciência e compreensão enquanto tratamos de tudo com o máximo de detalhe e dedicação.

Prometemos que vai valer a pena a espera 🪻$tpl$),

('paciencia_processo_en',
 'Patience during the process',
 'en', 'outros', 'order', 21, true,
 '[]'::jsonb,
$tpl$Flower preservation is a delicate process, carried out with great care at every stage, so we truly appreciate your patience and understanding while we take care of everything with the utmost detail and dedication.

We promise the wait will be worth it 🪻$tpl$),

('envio_factura_pt',
 'Envio de factura',
 'pt', 'factura', 'both', 10, true,
 '[]'::jsonb,
$tpl${saudacao} {nome} 🏵️

Segue em anexo a fatura.

Para qualquer questão, estamos à disposição.
Obrigada!$tpl$),

('envio_factura_en',
 'Sending invoice',
 'en', 'factura', 'both', 11, true,
 '[]'::jsonb,
$tpl$Hello {nome} 🏵️

Please find the invoice attached.

For any questions, we are at your disposal.
Thank you!$tpl$),

-- ═══════════ VALE-PRESENTE ═══════════

('vale_oferta_info_pt',
 'Vale-presente: lead quer oferecer',
 'pt', 'vale_presente', 'both', 5, true,
 '[]'::jsonb,
$tpl${saudacao} {nome} 🌸

Muito obrigada pela sua mensagem e pelo interesse no nosso trabalho!

Se está a pensar oferecer a preservação de flores, temos disponível o nosso vale-presente, em formato digital ou físico: um presente único, que oferece uma forma muito especial de guardar memórias em forma de arte 💐

Pode encontrar todas as informações aqui:
https://www.floresabeirario.pt/oferecer-preservacao

No nosso site encontra também todos os detalhes sobre como funciona o processo, as opções e os preços:
www.floresabeirario.pt

Qualquer dúvida, estamos ao dispor 🌷$tpl$),

('vale_oferta_info_en',
 'Gift voucher: lead wants to gift',
 'en', 'vale_presente', 'both', 6, true,
 '[]'::jsonb,
$tpl$Hello {nome} 🌸

Thank you so much for your message and for your interest in our work!

If you are thinking of gifting flower preservation, we offer our gift voucher, in digital or physical format: a unique present and a very special way of keeping memories in the form of art 💐

You can find all the information here:
https://www.floresabeirario.pt/oferecer-preservacao

On our website you will also find all the details about how the process works, our options and prices:
www.floresabeirario.pt/en

If you have any questions, we are happy to help 🌷$tpl$),

('vale_confirmacao_remetente_pt',
 'Vale-presente: confirmação ao remetente',
 'pt', 'vale_presente', 'voucher', 10, true,
 '[]'::jsonb,
$tpl${saudacao} {nome_remetente} 🌼

Muito obrigada pela sua encomenda, é um gosto fazer parte de um presente tão especial.

Confirmamos a escolha do vale no valor de {valor_vale}.

Após a receção do pagamento, enviaremos o vale em formato digital, pronto a ser oferecido.

Quando o destinatário receber o vale, deverá entrar em contacto connosco para agendar a data de entrega das flores e escolher as suas preferências, para depois darmos início ao processo de preservação.

Dados de pagamento:
{dados_pagamento}

Depois de efetuar o pagamento, agradecemos que nos envie o comprovativo. Caso pretenda a emissão de fatura com contribuinte, pode enviar-nos o NIF.

Se surgir qualquer dúvida, estamos por aqui 🪻$tpl$),

('vale_confirmacao_remetente_en',
 'Gift voucher: sender confirmation',
 'en', 'vale_presente', 'voucher', 11, true,
 '[]'::jsonb,
$tpl$Hello {nome_remetente} 🌼

Thank you so much for your order, it is a pleasure to be part of such a special gift.

We confirm your voucher in the amount of {valor_vale}.

Once we receive the payment, we will send you the voucher in digital format, ready to be gifted.

When the recipient receives the voucher, they should get in touch with us to schedule the flower delivery date and choose their preferences, so we can then begin the preservation process.

Payment details:
{dados_pagamento}

Once the payment has been made, we kindly ask you to send us the proof of payment. If you would like an invoice with your tax number, please feel free to share it with us.

If any questions come up, we are here 🪻$tpl$),

('vale_mensagem_destinatario_pt',
 'Vale-presente: mensagem ao destinatário',
 'pt', 'vale_presente', 'voucher', 20, true,
 '[]'::jsonb,
$tpl${saudacao} {nome_destinatario} 💌

Temos a alegria de lhe informar que tem um vale-presente de preservação de flores da Flores à Beira-Rio à sua espera 💐

Pode aceder ao seu voucher através deste link:
{link_vale}

Na página do vale encontra toda a informação necessária. Estamos totalmente disponíveis para qualquer esclarecimento ou ajuda neste processo.

Parabéns por este presente tão especial, será um gosto preservar as flores de um dia tão lindo. 🤍$tpl$),

('vale_mensagem_destinatario_en',
 'Gift voucher: message to recipient',
 'en', 'vale_presente', 'voucher', 21, true,
 '[]'::jsonb,
$tpl$Hello {nome_destinatario} 💌

We are delighted to let you know that a Flores à Beira-Rio flower preservation gift voucher is waiting for you 💐

You can access your voucher through this link:
{link_vale}

On the voucher page you will find all the information you need. We are fully available for any questions or help throughout this process.

Congratulations on such a special gift, it will be a pleasure to preserve the flowers of such a beautiful day. 🤍$tpl$),

('vale_confirmacao_recepcao_pt',
 'Vale-presente: pagamento confirmado + envio do vale',
 'pt', 'vale_presente', 'voucher', 30, true,
 '[]'::jsonb,
$tpl${saudacao} {nome_remetente} 🌻

Confirmamos a receção do pagamento 🎉

Segue o vale-presente digital:
{link_vale}

O vale já inclui toda a informação para os presenteados, não precisa de se preocupar com mais nada.

Enviaremos a fatura em breve.

Qualquer dúvida, estamos à disposição.
Agradecemos a sua confiança! 🌹$tpl$),

('vale_confirmacao_recepcao_en',
 'Gift voucher: payment confirmed + voucher sent',
 'en', 'vale_presente', 'voucher', 31, true,
 '[]'::jsonb,
$tpl$Hello {nome_remetente} 🌻

We confirm receipt of your payment 🎉

Here is the digital gift voucher:
{link_vale}

The voucher already includes all the information for the recipients, so you don't need to worry about anything else.

We will send you the invoice soon.

If you have any questions, we are at your disposal.
Thank you so much for your trust! 🌹$tpl$),

-- ═══════════ RONDA 2 (pedidos da Maria + situações das conversas) ═══════════

('confirmacao_reserva_dinheiro_pt',
 'Confirmação de reserva: pagamento em dinheiro na entrega',
 'pt', 'reserva', 'order', 15, true,
 '["entrega_agendada"]'::jsonb,
$tpl${saudacao} {nome} 🌷

Confirmamos a sua reserva. 🎉

Como combinado, o pagamento será feito em dinheiro no momento da entrega das flores. Pode pagar apenas o sinal de 30% ({valor_sinal}) ou, se preferir, juntar já a 2ª parcela de 40% ({valor_2a_parcela}), como vos for mais conveniente.

Segue a morada para entrega das flores:
📍 {morada_estudio}

O nosso atelier fica numa rua pequena sem acesso fácil para carros, por isso encontramo-nos convosco no ponto indicado no mapa, onde é simples parar o carro e fazer a entrega.

Quando souberem a que horas vão passar, pedimos que nos avisem antecipadamente e, novamente, quando estiverem a cerca de 10 minutos de chegar.

Até lá, mantenham o bouquet com os caules em água limpa o máximo de tempo possível, faz mesmo diferença no resultado da preservação. 💧

Também poderá acompanhar o estado da sua encomenda aqui:
{link_status}

Vai ser um gosto cuidar das vossas flores. 🌸$tpl$),

('confirmacao_reserva_dinheiro_en',
 'Booking confirmation: cash payment on drop-off',
 'en', 'reserva', 'order', 16, true,
 '["entrega_agendada"]'::jsonb,
$tpl$Dear {nome} 🌷

Your booking is now confirmed. 🎉

As agreed, the payment will be made in cash when you drop off the flowers. You can pay just the 30% deposit ({valor_sinal}) or, if you prefer, add the 2nd payment of 40% ({valor_2a_parcela}) as well, whichever is most convenient for you.

Here is the address for the flower drop-off:
📍 {morada_estudio}

Our studio is located on a small car-free street, so we will meet you at the easiest place to stop your car, which is the location provided above.

Once you know roughly what time you will be arriving, we kindly ask that you let us know in advance. Then, when you are about 10 minutes away, just send us a message so we can come up to meet you. 💐

Until then, please keep the bouquet with the stems in clean water for as long as possible, it really makes a difference to the preservation. 💧

You can also follow the progress of your order here:
{link_status}

It will be a pleasure to take care of your flowers. 🌸$tpl$),

('lembrete_pre_evento_pt',
 'Lembrete: o grande dia aproxima-se (morada + água)',
 'pt', 'reserva', 'order', 40, true,
 '["entrega_agendada"]'::jsonb,
$tpl${saudacao} {nome} 🌷

O vosso grande dia está quase a chegar! 🎉

Relembramos a morada para entrega das flores:
📍 {morada_estudio}

Quando souberem a que horas vão passar, pedimos só que nos informem antecipadamente e, novamente, quando estiverem a cerca de 10 minutos de chegar.

Até lá, o ideal é manter o bouquet com os caules em água limpa o máximo de tempo possível. 💧

Desejamos-vos um dia maravilhoso, cheio de amor e alegrias 🤍$tpl$),

('lembrete_pre_evento_en',
 'Reminder: the big day is coming (address + water)',
 'en', 'reserva', 'order', 41, true,
 '["entrega_agendada"]'::jsonb,
$tpl$Hello {nome} 🌷

Your big day is almost here! 🎉

Here is a reminder of the address for the flower drop-off:
📍 {morada_estudio}

Once you know roughly what time you will be passing by, we kindly ask that you let us know in advance and, again, when you are about 10 minutes away.

Until then, the ideal is to keep the bouquet with the stems in clean water for as long as possible. 💧

We wish you a wonderful day, full of love and joy 🤍$tpl$),

('como_funciona_processo_pt',
 'Como funciona o processo (prensagem → design → vidro museu)',
 'pt', 'pre_reserva', 'order', 7, true,
 '[]'::jsonb,
$tpl$Preservamos as flores através de um processo de prensagem, o que significa que ficam bidimensionais (planas), em vez de manterem o volume original.

Depois da prensagem, criamos uma composição artística personalizada com as flores do seu bouquet, sujeita à sua aprovação, que é depois emoldurada com vidro museu e materiais da mais alta qualidade, transformando-a numa peça única que guarda a memória do vosso dia para sempre. 🖼️

Pode ver os formatos, opções de fundo e preços no nosso site:
www.floresabeirario.pt

Qualquer dúvida, estamos por aqui 🌸$tpl$),

('como_funciona_processo_en',
 'How the process works (pressing → design → museum glass)',
 'en', 'pre_reserva', 'order', 8, true,
 '[]'::jsonb,
$tpl$We preserve flowers through a pressing process, which means they become two-dimensional (flat), instead of keeping their original volume.

After pressing, we create a personalised artistic composition with the flowers from your bouquet, subject to your approval, which is then framed with museum glass and the highest quality materials, turning it into a unique piece that keeps the memory of your day forever. 🖼️

You can see the formats, background options and prices on our website:
www.floresabeirario.pt/en

If you have any questions, we are here 🌸$tpl$),

('nao_fazemos_3d_pt',
 'Não fazemos preservação 3D/resina',
 'pt', 'pre_reserva', 'order', 9, true,
 '[]'::jsonb,
$tpl$Trabalhamos exclusivamente com a preservação de flores por prensagem, pelo que as composições são bidimensionais (planas).

Compreendemos a preferência por criações em 3D, mas não é um serviço que oferecemos, sobretudo por razões de durabilidade e sustentabilidade: a maioria dos métodos de preservação em 3D utiliza compostos químicos industriais que podem ser poluentes e nocivos para o ambiente e para quem os manuseia.

Se mudar de ideias, teremos todo o gosto em preservar o seu bouquet. Estamos ao dispor para qualquer questão 🌸$tpl$),

('nao_fazemos_3d_en',
 'We do not offer 3D/resin preservation',
 'en', 'pre_reserva', 'order', 9, true,
 '[]'::jsonb,
$tpl$We work exclusively with flower preservation through pressing, so our compositions are two-dimensional (flat).

We understand the preference for 3D creations, but it is not a service we offer, mainly for durability and sustainability reasons: most 3D preservation methods involve industrial chemical compounds that can be polluting and harmful to the environment and to the people who handle them.

If you change your mind, we would be delighted to preserve your bouquet. We are here for any questions 🌸$tpl$),

('mostrar_trabalhos_pt',
 'Cliente pede fotos de trabalhos + aprovação do design',
 'pt', 'pre_reserva', 'order', 14, true,
 '[]'::jsonb,
$tpl$Claro que sim! Enviamos em seguida fotografias de peças que criámos. 🌸

Uma coisa que é muito importante para nós: todos os designs são aprovados pelo cliente antes de colarmos definitivamente as flores. Durante a fase de composição, pode pedir os ajustes que quiser e afinamos o design até estar completamente feliz com o resultado.

O nosso objetivo é que adore o seu quadro e que ele reflita verdadeiramente a beleza e as memórias das suas flores. 💐$tpl$),

('mostrar_trabalhos_en',
 'Client asks for photos of our work + design approval',
 'en', 'pre_reserva', 'order', 15, true,
 '[]'::jsonb,
$tpl$Of course! We will send you photos of pieces we have created. 🌸

One thing that is very important to us: every design is approved by the client before we permanently glue the flowers. During the design stage, you can request any changes you would like, and we will refine the layout until you are completely happy with it.

Our goal is for you to absolutely love your frame and feel that it truly reflects the beauty and memories of your flowers. 💐$tpl$),

('resposta_orcamento_caro_pt',
 'Cliente acha caro / não tinha noção do orçamento',
 'pt', 'pre_reserva', 'order', 18, true,
 '[]'::jsonb,
$tpl$Sem problema algum, compreendemos perfeitamente. 😊

Gostaríamos apenas de partilhar que todas as nossas opções e preços estão disponíveis no nosso site:
https://www.floresabeirario.pt/opcoes-e-precos

O nosso quadro mais pequeno tem o valor de 300€ (30x40 cm) e inclui a preservação das flores, a composição personalizada e sujeita à sua aprovação, e o emolduramento com vidro museu, um vidro de elevada qualidade que ajuda a proteger a peça para que as flores do vosso dia possam ser apreciadas para sempre. 🖼️

Sabemos que é um investimento, mas a preservação é um processo que demora vários meses e que resulta numa peça verdadeiramente única e irrepetível.

De qualquer forma, agradecemos muito o seu interesse no nosso trabalho e desejamos-lhe um casamento maravilhoso e repleto de momentos felizes. 💐

Se tiver alguma questão, estaremos sempre disponíveis. 🌸$tpl$),

('resposta_orcamento_caro_en',
 'Client finds it expensive / was not aware of the price',
 'en', 'pre_reserva', 'order', 19, true,
 '[]'::jsonb,
$tpl$No problem at all, we completely understand. 😊

We would just like to share that all our options and prices are available on our website:
https://www.floresabeirario.pt/opcoes-e-precos

Our smallest frame costs 300€ (30x40 cm) and includes the preservation of the flowers, a personalised composition subject to your approval, and framing with museum glass, a high-quality glass that helps protect the piece so the flowers of your day can be enjoyed forever. 🖼️

We know it is an investment, but preservation is a process that takes several months and results in a truly unique, one-of-a-kind piece.

In any case, thank you so much for your interest in our work, and we wish you a wonderful wedding full of happy moments. 💐

If you have any questions, we are always available. 🌸$tpl$),

('flores_mau_estado_substituicao_pt',
 'Flores em risco de chegar em mau estado: opções',
 'pt', 'recepcao_flores', 'order', 20, true,
 '["entrega_agendada", "flores_enviadas", "flores_recebidas"]'::jsonb,
$tpl$Iremos preservar as flores no estado em que forem recebidas. Quando algumas flores já não chegam em condições adequadas para preservação, existem duas opções:

• Trabalharmos apenas com as flores que estiverem em condições de ser preservadas;
• Ou, caso prefira manter a composição mais próxima do bouquet original, substituirmos algumas flores por flores iguais (adquiridas através de uma florista). Neste caso, o custo das flores de substituição fica a seu cargo.

O nosso objetivo é sempre preservar as flores originais e manter a peça o mais fiel possível às flores do vosso dia especial. Diga-nos qual das opções prefere 🌺$tpl$),

('flores_mau_estado_substituicao_en',
 'Flowers at risk of arriving in poor condition: options',
 'en', 'recepcao_flores', 'order', 21, true,
 '["entrega_agendada", "flores_enviadas", "flores_recebidas"]'::jsonb,
$tpl$We will preserve the flowers in the condition in which they are received. When some flowers no longer arrive in adequate condition for preservation, there are two options:

• We work only with the flowers that are in good enough condition to be preserved;
• Or, if you prefer to keep the composition closer to the original bouquet, we can replace some flowers with identical ones (sourced through a florist). In that case, the cost of the replacement flowers is at your expense.

Our goal is always to preserve the original flowers and keep the piece as faithful as possible to the flowers of your special day. Let us know which option you prefer 🌺$tpl$),

('orcamento_envio_quadro_pt',
 'Envio do quadro final: como funciona o orçamento',
 'pt', 'entrega', 'order', 5, true,
 '[]'::jsonb,
$tpl$Relativamente ao envio do quadro final, os portes são calculados apenas quando o quadro (e as restantes peças da encomenda) estiverem concluídos e prontos a expedir. Só nessa altura conseguimos obter um orçamento exato, com base no tamanho e peso finais da embalagem e na morada de destino. 📦

Os quadros são cuidadosamente embalados como mercadoria frágil e já enviámos para vários países em segurança.

Em alternativa, o levantamento em mãos em Coimbra é sempre gratuito. 😊$tpl$),

('orcamento_envio_quadro_en',
 'Shipping the finished frame: how the quote works',
 'en', 'entrega', 'order', 6, true,
 '[]'::jsonb,
$tpl$Regarding the shipping of the finished frame, shipping costs are calculated only once your frame (and any other items included in your order) are completed and ready to be dispatched. Only then can we provide an accurate shipping quote, based on the final package size, weight and destination address. 📦

Our frames are carefully packaged as fragile goods, and we have already shipped internationally to several countries safely.

Alternatively, in-person pick-up in Coimbra is always free of charge. 😊$tpl$),

('quadro_enviado_tracking_pt',
 'Quadro enviado: código de seguimento',
 'pt', 'entrega', 'order', 10, true,
 '["quadro_enviado"]'::jsonb,
$tpl${saudacao} {nome} 🌷

O seu quadro já seguiu viagem! 🎁📦

Foi cuidadosamente embalado para chegar em perfeitas condições. Pode acompanhar o envio através do código de seguimento:
[código de seguimento]

Quando o receber, adoraríamos saber se chegou tudo bem e o que achou do resultado. 🤍

Qualquer questão, estamos por aqui 🌸$tpl$),

('quadro_enviado_tracking_en',
 'Frame shipped: tracking code',
 'en', 'entrega', 'order', 11, true,
 '["quadro_enviado"]'::jsonb,
$tpl$Hello {nome} 🌷

Your frame is on its way! 🎁📦

It has been carefully packaged to arrive in perfect condition. You can follow the shipment with the tracking code:
[tracking code]

Once it arrives, we would love to know that everything arrived safely and what you think of the result. 🤍

Any questions, we are here 🌸$tpl$),

('ponto_situacao_pt',
 'Ponto de situação: "como está a correr?"',
 'pt', 'outros', 'order', 15, true,
 '[]'::jsonb,
$tpl${saudacao} {nome} 🌷

Está tudo a correr muito bem com as suas flores! 😊

A preservação é um processo delicado, feito com muito cuidado em cada etapa, e neste momento estamos na fase de [fase atual].

Pode acompanhar o estado da sua encomenda a qualquer momento aqui:
{link_status}

Assim que tivermos novidades, entraremos em contacto. Obrigada pela confiança e paciência 🤍$tpl$),

('ponto_situacao_en',
 'Status check-in: "how is it going?"',
 'en', 'outros', 'order', 16, true,
 '[]'::jsonb,
$tpl$Hello {nome} 🌷

Everything is going very well with your flowers! 😊

Preservation is a delicate process, carried out with great care at every stage, and right now we are at the [current stage] phase.

You can follow the status of your order at any time here:
{link_status}

As soon as we have news, we will be in touch. Thank you for your trust and patience 🤍$tpl$),

('vale_reserva_coberta_pt',
 'Vale-presente: reserva do destinatário coberta pelo vale',
 'pt', 'vale_presente', 'order', 40, true,
 '["entrega_flores_agendar", "entrega_agendada"]'::jsonb,
$tpl${saudacao} {nome} 🌻

Muito obrigada por ter preenchido o formulário!

Recebemos a sua resposta e agradecemos imenso a sua confiança. 💐

A sua reserva está confirmada e o valor da encomenda é coberto pelo vale-presente que recebeu. 🎁

Em relação à entrega das flores, somos flexíveis, basta combinarmos a forma e o momento que vos forem mais convenientes.

Também poderá acompanhar o estado da sua encomenda aqui:
{link_status}

Vai ser um gosto cuidar das vossas flores. 🌸$tpl$),

('vale_reserva_coberta_en',
 'Gift voucher: recipient booking covered by voucher',
 'en', 'vale_presente', 'order', 41, true,
 '["entrega_flores_agendar", "entrega_agendada"]'::jsonb,
$tpl$Hello {nome} 🌻

Thank you so much for filling in our form!

We have received your response and truly appreciate your trust. 💐

Your booking is confirmed, and the value of your order is covered by the gift voucher you received. 🎁

Regarding the flower delivery, we are flexible, we just need to arrange the way and the time that suit you best.

You can also follow the status of your order here:
{link_status}

It will be a pleasure to take care of your flowers. 🌸$tpl$)

ON CONFLICT (slug) WHERE deleted_at IS NULL DO UPDATE SET
  name               = EXCLUDED.name,
  category           = EXCLUDED.category,
  scope              = EXCLUDED.scope,
  position           = EXCLUDED.position,
  is_seed            = true,
  suggested_statuses = EXCLUDED.suggested_statuses,
  body               = EXCLUDED.body;

-- ────────────────────────────────────────────────────────────
-- D. ARQUIVAR DUPLICADOS
-- ────────────────────────────────────────────────────────────
-- feedback_review_google_* (seed 041) foi substituído pelo
-- pedir_opiniao_quadro_* (mig 072), que é a versão aprovada.
UPDATE message_templates
   SET deleted_at = now()
 WHERE slug IN ('feedback_review_google_pt', 'feedback_review_google_en')
   AND deleted_at IS NULL;

COMMIT;

-- ============================================================
-- Verificações rápidas (correr depois da migração):
--
--   SELECT count(*) FROM message_templates WHERE deleted_at IS NULL;
--   -- ~50 (todas com par PT/EN excepto reajuste/pedir_opiniao já pareados)
--
--   SELECT language, count(*) FROM message_templates
--    WHERE deleted_at IS NULL GROUP BY language;
--   -- pt e en equilibrados
--
--   SELECT length(value) FROM system_settings WHERE key='claude_facts';
--   -- > 4000
-- ============================================================
