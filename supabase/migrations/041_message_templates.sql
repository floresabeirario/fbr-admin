-- ============================================================
-- Migration 041: Biblioteca de templates de mensagens
-- ============================================================
-- Maria queria centralizar as mensagens que costuma copiar-e-colar
-- nas conversas com clientes (WhatsApp/Email). Esta migração cria:
--
--   1. `message_templates` — biblioteca de templates com variáveis
--      ({nome}, {valor_sinal}, {dados_pagamento}, etc.). Cada
--      template tem nome, categoria, idioma (pt/en) e corpo. Os
--      estados sugeridos (suggested_statuses JSONB array) permitem
--      que o workbench mostre os templates "certos para esta fase"
--      destacados no topo do dropdown.
--
--   2. `system_settings` — pares chave/valor para configuração
--      global (titular da conta, IBAN, BIC, banco, MB Way, morada
--      do estúdio). Usados pela variável {dados_pagamento} e
--      similares para que se a Maria mudar de banco amanhã, basta
--      editar num só sítio.
--
-- RLS: admins escrevem; Ana (viewer) também pode ler templates
-- para futuramente conseguir usar o picker no workbench (mesmo
-- estando em modo leitura para o resto). Seed corre 30+ templates
-- pré-populados (extraídos das conversas WhatsApp reais da Maria).
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. TABELA system_settings
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_by  UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE system_settings IS
  'Configuração global (chave/valor). Usada para dados de pagamento e morada do estúdio referenciados em templates de mensagens.';

DROP TRIGGER IF EXISTS system_settings_updated_at ON system_settings;
CREATE TRIGGER system_settings_updated_at
  BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_settings_admins_all" ON system_settings;
CREATE POLICY "system_settings_admins_all" ON system_settings FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt'
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt'
    )
  );

DROP POLICY IF EXISTS "system_settings_authenticated_select" ON system_settings;
CREATE POLICY "system_settings_authenticated_select" ON system_settings FOR SELECT
  TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON system_settings TO authenticated;

-- Seed com os valores actuais (Maria pode editar via UI depois).
INSERT INTO system_settings (key, value) VALUES
  ('payment_account_holder', 'Maria João Gonçalves Brito'),
  ('payment_iban',           'PT50 0023 0000 4576 9749 3439 4'),
  ('payment_bic',            'CGDIPTPL'),
  ('payment_bank_name',      'Caixa Geral de Depósitos'),
  ('payment_mbway',          '935 896 353'),
  ('studio_address_url',     'https://goo.gl/maps/ufv9UxETHGTGhuBz8'),
  ('studio_address_text',    'Estúdio FBR — Coimbra')
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. TABELA message_templates
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_templates (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
  deleted_at   TIMESTAMPTZ,
  created_by   UUID REFERENCES auth.users(id),
  updated_by   UUID REFERENCES auth.users(id),

  -- Identificação
  slug         TEXT NOT NULL,                       -- ex: "pre_reserva_tamanho_escolhido"
  name         TEXT NOT NULL,                       -- ex: "Pré-reserva — tamanho escolhido"
  language     TEXT NOT NULL CHECK (language IN ('pt', 'en')),
  category     TEXT NOT NULL CHECK (category IN (
                  'pre_reserva',
                  'reserva',
                  'recepcao_flores',
                  'preservacao',
                  'aprovacao_design',
                  'finalizacao',
                  'entrega',
                  'pos_venda',
                  'factura',
                  'vale_presente',
                  'lembretes',
                  'outros'
                )),

  -- Conteúdo
  body         TEXT NOT NULL,

  -- Estados de encomenda nos quais este template é sugerido (destaque
  -- no topo do dropdown). JSONB array de OrderStatus. Vazio = nunca
  -- sugerido automaticamente (template "manual", aparece só na lista
  -- completa).
  suggested_statuses JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Aplicabilidade: 'order' = só Preservação, 'voucher' = só Vale,
  -- 'both' = aparece em ambos os workbenches.
  scope        TEXT NOT NULL DEFAULT 'order' CHECK (scope IN ('order', 'voucher', 'both')),

  -- Ordem de apresentação dentro da categoria
  position     INT NOT NULL DEFAULT 0,

  -- Templates seed (pré-populados pela migração) não podem ser apagados
  -- via UI — só arquivados. Identificados pelo flag is_seed.
  is_seed      BOOLEAN NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS message_templates_slug_unique
  ON message_templates(slug) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS message_templates_category_idx
  ON message_templates(category, position) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS message_templates_language_idx
  ON message_templates(language) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS message_templates_updated_at ON message_templates;
CREATE TRIGGER message_templates_updated_at
  BEFORE UPDATE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 3. RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_templates_admins_all" ON message_templates;
CREATE POLICY "message_templates_admins_all" ON message_templates FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt'
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'email' IN (
      'info+antonio@floresabeirario.pt',
      'info+mj@floresabeirario.pt'
    )
  );

DROP POLICY IF EXISTS "message_templates_authenticated_select" ON message_templates;
CREATE POLICY "message_templates_authenticated_select" ON message_templates FOR SELECT
  TO authenticated USING (deleted_at IS NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON message_templates TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 4. AUDIT LOG
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_message_template_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log(table_name, record_id, action, new_values, changed_by)
    VALUES ('message_templates', NEW.id, 'INSERT', to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, changed_by)
    VALUES ('message_templates', NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log(table_name, record_id, action, old_values, changed_by)
    VALUES ('message_templates', OLD.id, 'DELETE', to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS message_templates_audit ON message_templates;
CREATE TRIGGER message_templates_audit
  AFTER INSERT OR UPDATE OR DELETE ON message_templates
  FOR EACH ROW EXECUTE FUNCTION log_message_template_changes();

-- ────────────────────────────────────────────────────────────
-- 5. SEED — templates pré-populados (extraídos das conversas reais)
-- ────────────────────────────────────────────────────────────
-- Variáveis usadas no body (resolvidas em runtime, src/lib/templates.ts):
--   {saudacao}              → "Bom dia"/"Boa tarde"/"Boa noite" conforme hora
--   {saudacao_en}           → "Good morning"/"Good afternoon"/"Good evening"
--   {nome}                  → primeiro nome do cliente (clean)
--   {tamanho_quadro}        → "30x40 cm", "40x50 cm", "50x70 cm"
--   {valor_quadro}          → "300€", "400€", "500€"
--   {valor_total}           → total da encomenda (€)
--   {valor_sinal}           → 30% do total (€)
--   {valor_2a_parcela}      → 40% do total (€)
--   {valor_3a_parcela}      → 30% do total (€)
--   {data_evento}           → dd/MM/yyyy
--   {data_evento_extenso}   → "15 de Maio de 2026"
--   {data_evento_extenso_en}→ "May 15th, 2026"
--   {link_status}           → URL público de status
--   {dados_pagamento}       → bloco completo (PT ou EN conforme idioma do template)
--   {morada_estudio}        → link Maps do estúdio
--   {codigo_vale}           → código de vale-presente
--   {link_vale}             → URL do vale
--   {nome_remetente}        → nome do remetente do vale
--   {nome_destinatario}     → nome do destinatário do vale
--   {valor_vale}            → valor do vale (€)
--
INSERT INTO message_templates (slug, name, language, category, scope, position, is_seed, suggested_statuses, body) VALUES

-- ═══════════════════════════ PRÉ-RESERVA (PT) ═══════════════════════════

('pre_reserva_tamanho_escolhido_pt',
 'Pré-reserva — tamanho escolhido',
 'pt', 'pre_reserva', 'order', 10, true,
 '["entrega_flores_agendar"]'::jsonb,
$$Cara {nome},

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

Mais uma vez, muito obrigada pela confiança e carinho!
{saudacao} 🌻$$),

('pre_reserva_tamanho_indeciso_pt',
 'Pré-reserva — tamanho ainda por escolher',
 'pt', 'pre_reserva', 'order', 20, true,
 '["entrega_flores_agendar"]'::jsonb,
$${saudacao} {nome} 🌸

Muito obrigada por ter preenchido o formulário!

Recebemos a sua resposta e agradecemos imenso a sua confiança. 💐

Como ainda não decidiu o tamanho do quadro, neste momento, para reservarmos a data, o sinal corresponde a 30% do valor do quadro mais pequeno (30x40 cm – 300€), ou seja, 90€. Mais tarde, quando souber o tamanho concreto que prefere, se optar por um quadro maior, basta calcularmos a diferença.

Pode levar o tempo que precisar — muitos clientes preferem escolher o tamanho depois das flores estarem preservadas, para conseguirmos perceber qual o formato que melhor valoriza a composição.

O plano de pagamentos é o seguinte:
- 30% (90€) para reservar a data
- 40% (120€) após receção das flores
- 30% (90€) na conclusão do quadro, antes da entrega

Aqui ficam os dados para o pagamento do sinal:
{dados_pagamento}

Depois de efetuar o pagamento, agradecemos que nos envie o comprovativo. Caso pretenda a emissão de fatura com contribuinte, pode enviar-nos o NIF.

Se quiser, teremos todo o gosto em falar consigo por telefone, seja para esclarecer qualquer dúvida ou simplesmente para nos conhecermos 😊

Mais uma vez, muito obrigada pela confiança! 🌺$$),

-- ═══════════════════════════ PRÉ-RESERVA (EN) ═══════════════════════════

('pre_reserva_tamanho_escolhido_en',
 'Pre-booking — frame size chosen',
 'en', 'pre_reserva', 'order', 10, true,
 '["entrega_flores_agendar"]'::jsonb,
$$Dear {nome} 🌸

Thank you so much for filling out the form!
We have received your response and truly appreciate your trust. 💐
We would also like to inform you that we still have availability for your date of {data_evento_extenso_en}.

You have chosen the {tamanho_quadro} frame ({valor_quadro}).
To confirm your booking, we kindly ask for a 30% deposit ({valor_sinal}).
The payment plan is as follows:
- 30% ({valor_sinal}) to book the date
- 40% ({valor_2a_parcela}) upon receipt of the flowers
- 30% ({valor_3a_parcela}) upon completion of the frame, before delivery

Here are the payment details for the deposit:
{dados_pagamento}

After making the payment, we kindly ask you to send us the proof of payment. If you would like an invoice issued with your tax number, please feel free to send us your NIF.

Once again, thank you so much for your trust and kindness! 🌺$$),

('pre_reserva_tamanho_indeciso_en',
 'Pre-booking — frame size undecided',
 'en', 'pre_reserva', 'order', 20, true,
 '["entrega_flores_agendar"]'::jsonb,
$$Dear {nome} 🌷

Thank you so much for filling in our pre-booking form!

We have received your response and truly appreciate your trust in our work 💐

As you haven''t yet decided on the frame size, to secure your date, the booking deposit corresponds to 30% of the smallest frame (30x40 cm – 300€), which is 90€. Later on, once you''ve chosen your preferred size, if you decide on a larger frame, we will simply calculate the difference. You can take your time to decide — many clients prefer to choose the size after the flowers have been preserved, so we can better understand which format suits your floral composition best.

The payment plan is as follows:
- 30% (90€) to secure the date
- 40% (120€) upon receiving the flowers
- 30% (90€) upon completion of the frame, before delivery

Here are the payment details for the deposit:
{dados_pagamento}

Once the payment has been made, we kindly ask you to send us the proof of payment. If you would like an invoice with your tax number, please feel free to share your details with us.

Once again, thank you so much for your trust 🌺$$),

-- ═══════════════════════════ LEMBRETE PRÉ-RESERVA (PT/EN) ═══════════════════════════

('lembrete_reserva_nao_paga_pt',
 'Lembrete — reserva ainda não confirmada',
 'pt', 'lembretes', 'order', 10, true,
 '["entrega_flores_agendar"]'::jsonb,
$${saudacao} {nome} 🌸

Apenas uma pequena nota para informar que, neste momento, a sua data ainda não está reservada.

Só conseguimos garantir a reserva após o pagamento do sinal — entretanto a disponibilidade pode alterar-se.

Se tiver alguma dúvida ou precisar de ajuda no processo, estamos por aqui 💐$$),

('lembrete_reserva_nao_paga_en',
 'Reminder — booking not yet confirmed',
 'en', 'lembretes', 'order', 10, true,
 '["entrega_flores_agendar"]'::jsonb,
$$Hello {nome} 🌸

Just a quick note to let you know that, at this moment, your date is not yet reserved.

We can only secure the booking once the deposit payment is completed, and availability may change in the meantime.

If you have any questions or need any help with the process, feel free to ask 💐$$),

-- ═══════════════════════════ CONFIRMAÇÃO DE RESERVA (PT) ═══════════════════════════

('confirmacao_reserva_maos_pt',
 'Confirmação de reserva — entrega em mãos',
 'pt', 'reserva', 'order', 10, true,
 '["entrega_agendada"]'::jsonb,
$${saudacao} {nome} 🌷

Confirmamos a reserva. 🎉

Segue a morada para entrega das flores a partir do dia {data_evento_extenso}:

📍 {morada_estudio}

Quando souberem o dia e as horas a que vão passar, pedimos só que nos informem antecipadamente.

Também poderá acompanhar o estado da sua encomenda aqui:
{link_status}

Vai ser um gosto cuidar das vossas flores. 🌸

Qualquer dúvida, estamos disponíveis.
{saudacao} 🥰🌹$$),

('confirmacao_reserva_ctt_pt',
 'Confirmação de reserva — envio por CTT',
 'pt', 'reserva', 'order', 20, true,
 '["entrega_agendada"]'::jsonb,
$${saudacao} {nome} 🌷

Confirmamos a reserva. 🎉

Indicou que pretende enviar as flores por CTT/transportadora. Poderia partilhar connosco onde será o evento/de que local fará o envio? Iremos enviar-lhe todas as instruções detalhadas para preparar e enviar as flores em segurança, de forma a que cheguem até nós nas melhores condições 🌷

Também poderá acompanhar o estado da sua encomenda aqui:
{link_status}

Vai ser um gosto cuidar das vossas flores. 🌸$$),

('confirmacao_reserva_recolha_pt',
 'Confirmação de reserva — recolha no local',
 'pt', 'reserva', 'order', 30, true,
 '["entrega_agendada"]'::jsonb,
$${saudacao} {nome} 🌷

Confirmamos a recepção e a reserva. 🎉

📍 A recolha fica agendada para o dia {data_evento_extenso}.

Pedimos só que nos indiquem a janela horária que vos for mais conveniente.

Também poderá acompanhar o estado da sua encomenda aqui:
{link_status}

Vai ser um gosto cuidar das vossas flores. 🌸

Qualquer dúvida, estamos disponíveis.$$),

-- ═══════════════════════════ CONFIRMAÇÃO DE RESERVA (EN) ═══════════════════════════

('confirmacao_reserva_recolha_en',
 'Booking confirmation — collection at venue',
 'en', 'reserva', 'order', 30, true,
 '["entrega_agendada"]'::jsonb,
$$Hello {nome} 🌷

We confirm receipt and the reservation. 🎉

📍 The collection is scheduled for {data_evento_extenso_en}.

Please let us know the specific time window that''s most convenient for you.

You can also track the status of your order here:
{link_status}

It will be a pleasure to take care of your flowers. 🌸

If you have any questions, we are always available. If anything changes, let us know, we''ll find a solution. 🪻$$),

-- ═══════════════════════════ INSTRUÇÕES PRÉ-RECOLHA (PT/EN) ═══════════════════════════

('preparacao_flores_pt',
 'Preparação das flores antes da recolha/entrega',
 'pt', 'reserva', 'order', 50, true,
 '["entrega_agendada"]'::jsonb,
$${saudacao} {nome} 🌷

Não precisa preocupar-se com nada — assim que as flores estiverem connosco, tomamos conta de tudo.

Antes da nossa chegada (ou da entrega), basta mudar a água (para água nova) esta noite e amanhã de manhã, e manter o ramo na divisão mais fresca da casa (sem colocar no frigorífico) e longe da luz solar. É só isso 💐😊$$),

('preparacao_flores_en',
 'Flower preparation before collection/delivery',
 'en', 'reserva', 'order', 50, true,
 '["entrega_agendada"]'::jsonb,
$$You don''t need to worry about anything — once the flowers are with us, we will take care of them.

Before our arrival, just change the water (to a new one) this evening and tomorrow morning, and keep the bouquet in the coolest room of your home (please don''t place it in the fridge), and away from sunlight. That''s all 💐😊$$),

-- ═══════════════════════════ RECEPÇÃO DAS FLORES + 2ª PARCELA (PT/EN) ═══════════════════════════

('recepcao_flores_2a_parcela_pt',
 'Recepção das flores + 2ª parcela (40%)',
 'pt', 'recepcao_flores', 'order', 10, true,
 '["flores_recebidas", "flores_na_prensa"]'::jsonb,
$${saudacao} {nome} 🌷

As suas flores já chegaram a Coimbra! São absolutamente lindíssimas. 🤍

Nesta fase, dá-se também o pagamento da segunda parcela, correspondente a 40% do valor total — {valor_2a_parcela}.

Pode fazê-lo por:
{dados_pagamento}

Assim que o pagamento estiver feito, pedimos apenas que nos envie o comprovativo.
Se quiser fatura, pode enviar-nos o NIF.

Obrigada por nos confiar algo tão especial.
Muitas felicidades 🌸$$),

('recepcao_flores_2a_parcela_en',
 'Flowers received + 2nd payment (40%)',
 'en', 'recepcao_flores', 'order', 10, true,
 '["flores_recebidas", "flores_na_prensa"]'::jsonb,
$$Hello {nome} 🪻

Your flowers have safely arrived in Coimbra and they''re going in the press! They are absolutely beautiful. 🤍

At this stage, the second payment is also due, corresponding to 40% of the total amount — {valor_2a_parcela}.

Here are the payment details:
{dados_pagamento}

Once the payment has been made, we kindly ask that you send us the proof of payment.
If you would like an invoice with your NIF, please let us know.
We''ll send you the invoice for the deposit soon.

Thank you so much for trusting us your flowers, and wishing you all the happiness in the world 🌸$$),

-- ═══════════════════════════ ORIENTAÇÃO DO QUADRO (PT) ═══════════════════════════

('orientacao_quadro_pt',
 'Pedido de orientação do quadro',
 'pt', 'preservacao', 'order', 10, true,
 '["flores_na_prensa", "reconstrucao_botanica", "a_compor_design"]'::jsonb,
$${saudacao} {nome} 🌼

Dentro das próximas duas semanas, iremos enviar-lhe a fotografia da composição do seu quadro. Depois de aprovar a composição, avançaremos para colar as flores no vidro e, de seguida, emoldurar.

Gostaria também de perguntar a sua preferência quanto à orientação do quadro: prefere que seja vertical, horizontal, ou escolhemos nós consoante o que valorize melhor a composição?

Ficamos a aguardar 🌷$$),

-- ═══════════════════════════ APROVAÇÃO DE DESIGN (PT/EN) ═══════════════════════════

('aprovacao_design_pt',
 'Aprovação de design',
 'pt', 'aprovacao_design', 'order', 10, true,
 '["a_aguardar_aprovacao", "a_compor_design"]'::jsonb,
$$Cara {nome},

Enviamos a proposta de composição do quadro!

As flores ainda não estão coladas — pedimos agora que nos confirme se está tudo do seu agrado ou se deseja algum ajuste. Esperamos que goste.

Assim que tivermos o seu "sim", colamos as flores ao vidro e mandamos emoldurar.

Ficamos a aguardar o seu feedback 🤍$$),

('aprovacao_design_en',
 'Design approval',
 'en', 'aprovacao_design', 'order', 10, true,
 '["a_aguardar_aprovacao", "a_compor_design"]'::jsonb,
$$Dear {nome},

We''re sending you the composition proposal for your frame!

The flowers are not yet glued — we kindly ask you to confirm if everything is to your liking, or if you''d like any adjustments. We hope you love it.

Once we have your "yes", we''ll glue the flowers to the glass and send it off to be framed.

We''re looking forward to your feedback 🤍$$),

-- ═══════════════════════════ PRONTO PARA LEVANTAMENTO + 3ª PARCELA (PT) ═══════════════════════════

('quadro_pronto_3a_parcela_pt',
 'Quadro pronto + 3ª parcela (30%)',
 'pt', 'finalizacao', 'order', 10, true,
 '["quadro_pronto", "emoldurado"]'::jsonb,
$$Cara {nome},

O quadro já está pronto para recolha 🎁💌

Informamos também que este é o momento do pagamento da terceira e última parcela (30%), no valor de {valor_3a_parcela}.

Pode fazê-lo por:
{dados_pagamento}

Assim que o pagamento estiver feito, pedimos apenas que nos envie o comprovativo.
Caso deseje fatura, pode também enviar-nos o NIF.

Qualquer questão, estamos por aqui.

Obrigada 🤍$$),

('quadro_pronto_3a_parcela_en',
 'Frame ready + 3rd payment (30%)',
 'en', 'finalizacao', 'order', 10, true,
 '["quadro_pronto", "emoldurado"]'::jsonb,
$$Dear {nome},

Your frame is ready to be collected/shipped 🎁💌

This is also the moment for the third and final payment (30%), corresponding to {valor_3a_parcela}.

Here are the payment details:
{dados_pagamento}

Once the payment has been made, please send us the proof of payment.
If you would like an invoice, please share your NIF as well.

Any questions, we''re here.

Thank you 🤍$$),

-- ═══════════════════════════ PÓS-VENDA + REVIEW (PT/EN) ═══════════════════════════

('feedback_review_google_pt',
 'Pedido de feedback + review Google',
 'pt', 'pos_venda', 'order', 10, true,
 '["quadro_recebido"]'::jsonb,
$${saudacao} {nome} 🪻

Esperamos que estejam todos bem.
Queríamos muito saber se gostaram do quadro e se correspondeu às vossas expectativas. Foi um gosto enorme criar esta peça tão especial. 🤍

Se tiverem disponibilidade, gostaríamos de pedir-vos um pequeno gesto que nos ajudaria imenso: se puderem deixar um feedback sobre a vossa experiência na nossa página do Google Business, faria mesmo a diferença para nós e ajuda outras noivas a encontrarem o nosso trabalho.

Podem fazê-lo aqui:
https://g.page/r/CYW02ZVkOVz4EBM/review

Se quiserem, podem até acrescentar uma fotografia do quadro na vossa casa — adoraríamos ver 🤍

Obrigada, uma vez mais, pela confiança. 🌷💌$$),

('feedback_review_google_en',
 'Feedback request + Google review',
 'en', 'pos_venda', 'order', 10, true,
 '["quadro_recebido"]'::jsonb,
$$Hello {nome} 🪻

We hope you''re all well.
We''d love to know if you liked the frame and whether it matched your expectations. It was a true pleasure to create this special piece. 🤍

If you have a moment, we''d be incredibly grateful if you could leave a short review of your experience on our Google Business page — it would make a real difference for us and helps other brides find our work.

You can do it here:
https://g.page/r/CYW02ZVkOVz4EBM/review

If you''d like, feel free to add a photo of the frame in your home — we''d love to see it 🤍

Thank you, once again, for your trust. 🌷💌$$),

-- ═══════════════════════════ FACTURA (PT/EN) ═══════════════════════════

('envio_factura_pt',
 'Envio de factura',
 'pt', 'factura', 'both', 10, true,
 '[]'::jsonb,
$${saudacao} {nome} 🏵️

Segue em anexo a fatura.

Para qualquer questão, estamos à disposição.
{saudacao}!$$),

('envio_factura_en',
 'Sending invoice',
 'en', 'factura', 'both', 10, true,
 '[]'::jsonb,
$$Hello {nome} 🏵️

Please find the invoice attached.

For any questions, we''re at your disposal.
Have a lovely day!$$),

-- ═══════════════════════════ VALE-PRESENTE (PT) ═══════════════════════════

('vale_confirmacao_remetente_pt',
 'Vale-presente — confirmação ao remetente',
 'pt', 'vale_presente', 'voucher', 10, true,
 '[]'::jsonb,
$${saudacao} {nome_remetente} 🌼

Muito obrigada pela sua encomenda, é um gosto fazer parte de um presente tão especial.

Confirmamos a escolha do vale no valor de {valor_vale}.

Após a receção do pagamento, enviaremos o vale em formato digital, pronto a ser oferecido.

Quando o casal/destinatário receber o vale, deverão entrar em contacto connosco para agendar a data de entrega das flores e escolher as suas preferências, para depois darmos início ao processo de preservação.

Dados de pagamento:
{dados_pagamento}

Depois de efetuar o pagamento, agradecemos que nos envie o comprovativo. Caso pretenda a emissão de fatura com contribuinte, pode enviar-nos o NIF.

Se surgir qualquer dúvida, estamos por aqui 🪻$$),

('vale_mensagem_destinatario_pt',
 'Vale-presente — mensagem ao destinatário',
 'pt', 'vale_presente', 'voucher', 20, true,
 '[]'::jsonb,
$${saudacao} {nome_destinatario} 💌

Temos a alegria de lhe informar que tem um vale-presente de preservação de flores da Flores à Beira-Rio à sua espera 💐

Pode aceder ao seu voucher através deste link:
{link_vale}

Na página do vale encontra toda a informação necessária. Estamos totalmente disponíveis para qualquer esclarecimento ou ajuda neste processo.

Parabéns por este presente tão especial, será um gosto preservar as flores de um dia tão lindo. 🤍$$),

('vale_confirmacao_recepcao_pt',
 'Vale-presente — confirmação após pagamento + envio do vale',
 'pt', 'vale_presente', 'voucher', 30, true,
 '[]'::jsonb,
$${saudacao} {nome_remetente} 🌻

Confirmamos a receção do pagamento 🎉

Segue o vale-presente digital:
{link_vale}

O vale já inclui toda a informação para os presenteados, não precisa de se preocupar com mais nada.

Enviaremos a fatura em breve.

Qualquer dúvida, estamos à disposição.
Agradecemos a sua confiança e {saudacao}! 🌹$$),

-- ═══════════════════════════ OUTROS (PT) ═══════════════════════════

('paciencia_processo_pt',
 'Pedido de paciência durante o processo',
 'pt', 'outros', 'order', 10, true,
 '[]'::jsonb,
$$A preservação de flores requer um processo delicado e feito com muito cuidado em cada etapa, por isso agradecemos muito a vossa paciência e compreensão enquanto tratamos de tudo com o máximo de detalhe e dedicação.

Prometemos que vai valer a pena a espera 🪻$$),

('janela_horaria_pt',
 'Pedido de janela horária',
 'pt', 'reserva', 'order', 60, true,
 '["entrega_agendada"]'::jsonb,
$${saudacao} {nome} 🌻

Do nosso lado somos bastante flexíveis em relação ao horário.
Pedimos apenas que, assim que tiverem uma ideia da janela horária, nos avisem para conseguirmos organizar-nos.

Qualquer coisa, estamos por aqui 🌸$$),

('janela_horaria_en',
 'Time window request',
 'en', 'reserva', 'order', 60, true,
 '["entrega_agendada"]'::jsonb,
$$Hello {nome} 🌻

We''re very flexible with timing on our side.
We just ask that, as soon as you have an idea of the time window, you let us know so we can organise ourselves accordingly.

Anything you need, we''re here 🌸$$)
ON CONFLICT (slug) WHERE deleted_at IS NULL DO NOTHING;

COMMIT;
