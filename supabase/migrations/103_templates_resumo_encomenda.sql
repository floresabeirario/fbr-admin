-- ============================================================
-- 103 — Templates passam a listar TUDO o que o cliente encomendou
-- ============================================================
-- Problema (relatado pela Maria, sessão 156): as mensagens só falavam do
-- quadro principal ("Escolheu o quadro 30x40 cm (300€)") e nunca dos
-- extras, mesmo quando a encomenda tinha, por exemplo, 2 ornamentos de
-- Natal. As contas estavam certas (o sinal e as parcelas já saíam do
-- orçamento total), mas o cliente não via de onde vinha o valor.
--
-- Causa: a variável {resumo_encomenda} foi criada na sessão 147 no motor
-- de templates (src/lib/templates.ts) mas NUNCA foi posta em nenhum corpo
-- de template. Existia e não era usada.
--
-- Esta migração troca, nas 3 templates que descrevem o que foi escolhido
-- (PT+EN), a frase do quadro único pelo {resumo_encomenda}, que rende:
--   • Quadro 30x40 cm (300€)
--   • 2× Ornamento de Natal (2 × 25€ = 50€)
--
--   Total: 350€
-- (com um só item não há linha de total — seria repetição).
--
-- Apenas DADOS (message_templates.body): sem schema, GRANT, RLS ou tipos.
-- Substituição cirúrgica (padrão da mig 095): não reescreve o corpo todo,
-- por isso não apaga afinações que a Maria tenha feito à mão no admin.
-- Idempotente: à 2ª passagem as frases antigas já não existem.
--
-- ORDEM: pode correr antes ou depois do deploy. Antes do deploy o
-- {resumo_encomenda} já é resolvido pelo motor actual (existe desde a
-- 147); o deploy desta sessão só melhora os rótulos e junta o total.

-- ── 1. Pré-reserva, tamanho ESCOLHIDO (PT + EN) ──────────────

UPDATE message_templates
   SET body = REPLACE(
     body,
     $old$Escolheu o quadro {tamanho_quadro} ({valor_quadro}).$old$,
     $new$Escolheu:

{resumo_encomenda}$new$)
 WHERE slug = 'pre_reserva_tamanho_escolhido_pt'
   AND body NOT LIKE '%{resumo_encomenda}%';

UPDATE message_templates
   SET body = REPLACE(
     body,
     $old$You have chosen the {tamanho_quadro} frame ({valor_quadro}).$old$,
     $new$You have chosen:

{resumo_encomenda}$new$)
 WHERE slug = 'pre_reserva_tamanho_escolhido_en'
   AND body NOT LIKE '%{resumo_encomenda}%';

-- ── 2. Pré-reserva, tamanho POR ESCOLHER (PT + EN) ───────────
-- Aqui havia ainda um erro de contas quando existiam extras: o texto
-- dizia que o sinal era "30% do valor do quadro mais pequeno", mas o
-- {valor_sinal} é 30% do total (quadro provisório + extras). A frase nova
-- mostra a soma provisória inteira e pede 30% dela.

UPDATE message_templates
   SET body = REPLACE(
     body,
     $old$Como ainda não decidiu o tamanho do quadro, neste momento, para reservarmos a data, o sinal corresponde a 30% do valor do quadro mais pequeno (30x40 cm, {valor_quadro}), ou seja, {valor_sinal}. Mais tarde, quando souber o tamanho concreto que prefere, se optar por um quadro maior, basta calcularmos a diferença.$old$,
     $new$Como ainda não decidiu o tamanho do quadro, para reservarmos a data contamos por agora com o quadro mais pequeno (30x40 cm). Fica assim:

{resumo_encomenda}

O sinal é 30% deste valor, ou seja, {valor_sinal}. Mais tarde, quando souber o tamanho concreto que prefere, se optar por um quadro maior, basta calcularmos a diferença.$new$)
 WHERE slug = 'pre_reserva_tamanho_indeciso_pt'
   AND body NOT LIKE '%{resumo_encomenda}%';

UPDATE message_templates
   SET body = REPLACE(
     body,
     $old$As you haven't yet decided on the frame size, to secure your date, the booking deposit corresponds to 30% of the smallest frame (30x40 cm, {valor_quadro}), which is {valor_sinal}. Later on, once you've chosen your preferred size, if you decide on a larger frame, we will simply calculate the difference.$old$,
     $new$As you haven't yet decided on the frame size, for now we count on the smallest frame (30x40 cm) to secure your date. Here is how it adds up:

{resumo_encomenda}

The deposit is 30% of this amount, which is {valor_sinal}. Later on, once you've chosen your preferred size, if you decide on a larger frame, we will simply calculate the difference.$new$)
 WHERE slug = 'pre_reserva_tamanho_indeciso_en'
   AND body NOT LIKE '%{resumo_encomenda}%';

-- ── 3. Reajuste depois de escolhido o tamanho (PT + EN) ──────

UPDATE message_templates
   SET body = REPLACE(
     body,
     $old$Como optou pelo quadro de {tamanho_quadro} ({valor_total}), os valores ajustam-se. Subtraindo$old$,
     $new$Como optou pelo quadro de {tamanho_quadro}, os valores ajustam-se:

{resumo_encomenda}

Subtraindo$new$)
 WHERE slug = 'reajuste_pagamento_tamanho_pt'
   AND body NOT LIKE '%{resumo_encomenda}%';

UPDATE message_templates
   SET body = REPLACE(
     body,
     $old$As you chose the {tamanho_quadro} ({valor_total}) frame, the amounts adjust accordingly. Subtracting$old$,
     $new$As you chose the {tamanho_quadro} frame, the amounts adjust accordingly:

{resumo_encomenda}

Subtracting$new$)
 WHERE slug = 'reajuste_pagamento_tamanho_en'
   AND body NOT LIKE '%{resumo_encomenda}%';

-- ── Verificação (correr à mão depois) ────────────────────────
-- (a) As 6 templates têm de ficar com a variável:
--   SELECT slug, body LIKE '%{resumo_encomenda}%' AS tem_resumo
--     FROM message_templates
--    WHERE slug IN ('pre_reserva_tamanho_escolhido_pt','pre_reserva_tamanho_escolhido_en',
--                   'pre_reserva_tamanho_indeciso_pt','pre_reserva_tamanho_indeciso_en',
--                   'reajuste_pagamento_tamanho_pt','reajuste_pagamento_tamanho_en')
--    ORDER BY slug;
--   Esperado: 6 linhas, todas TRUE. Se alguma vier FALSE, foi editada à
--   mão e o texto antigo já não bate certo — basta abrir essa template no
--   admin (Comunicações → Templates) e trocar a frase do quadro por
--   {resumo_encomenda}.
--
-- (b) Não deve sobrar nenhuma template a descrever só o quadro:
--   SELECT slug FROM message_templates
--    WHERE deleted_at IS NULL AND body LIKE '%({valor_quadro})%';
--   Esperado: 0 linhas.
