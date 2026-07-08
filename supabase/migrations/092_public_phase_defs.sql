-- ============================================================
-- 092 — Fonte única da fase pública (RPC get_public_order_status)
--
-- PORQUÊ: o mapeamento estado→fase pública + labels + mensagens
-- default estava DUPLICADO em src/lib/public-status.ts (admin) e
-- utils/supabase.js (fbr-tracking). Dois repos, duas linguagens:
-- fácil mudar um e esquecer o outro → o site público passa a mentir.
--
-- SOLUÇÃO: esta RPC passa a ser a fonte única em runtime para os
-- sites públicos. O fbr-tracking deixa de ter qualquer mapa — só
-- chama esta função e formata. O admin mantém public-status.ts para
-- a SUA UI síncrona (badges/selects/cores/edição), com um teste de
-- drift a garantir que o mapeamento não diverge (public-status-sync.test.ts).
--
-- SEGURANÇA: SECURITY INVOKER — corre com os direitos do anon, logo
-- a policy existente `orders_public_status_read` continua a governar
-- a visibilidade (só encomendas pagas e não arquivadas). Não bypassa
-- RLS. Só precisa das colunas públicas já concedidas ao anon.
--
-- ROLLOUT: esta migração é ADITIVA (nova função, não mexe em nada).
-- Correr PRIMEIRO no Supabase; SÓ DEPOIS fazer push do fbr-tracking
-- refatorizado. Enquanto a função não existir, o tracking antigo
-- continua a funcionar.
-- ============================================================

create or replace function public.get_public_order_status(p_order_id text)
returns jsonb
language plpgsql
security invoker
stable
as $$
declare
  v_order    record;
  v_global   jsonb;
  v_phase    int;          -- 0..12; NULL quando cancelada
  v_key      text;         -- '0'..'12' ou 'cancelada'
  v_label_pt text; v_label_en text;
  v_def_pt   text; v_def_en text;
  v_msg_pt   text; v_msg_en text;
begin
  select order_id, client_name, couple_names, status,
         public_status_message_pt, public_status_message_en,
         public_status_language, estimated_delivery_date,
         public_status_updated_at
    into v_order
  from public.orders
  where order_id = p_order_id;

  if not found then
    return null;  -- inexistente OU invisível ao anon (não paga/arquivada)
  end if;

  -- ── estado interno → fase pública ──────────────────────────
  -- (espelhado em src/lib/public-status.ts STATUS_TO_PUBLIC_PHASE;
  --  guardado pelo teste public-status-sync.test.ts)
  v_phase := case v_order.status
    when 'entrega_flores_agendar' then 0
    when 'entrega_agendada'       then 1
    when 'flores_enviadas'        then 1
    when 'flores_recebidas'       then 2
    when 'flores_na_prensa'       then 3
    when 'reconstrucao_botanica'  then 4
    when 'a_compor_design'        then 5
    when 'a_aguardar_aprovacao'   then 6
    when 'a_finalizar_quadro'     then 7
    when 'a_ser_emoldurado'       then 8
    when 'emoldurado'             then 8
    when 'a_ser_fotografado'      then 9
    when 'quadro_pronto'          then 10
    when 'quadro_enviado'         then 11
    when 'quadro_recebido'        then 12
    when 'cancelado'              then null
    else 0  -- estado desconhecido (BD à frente do código) → pré-timeline, não rebentar
  end;

  v_key := case when v_order.status = 'cancelado' then 'cancelada' else v_phase::text end;

  -- ── labels da fase (PT/EN) ─────────────────────────────────
  v_label_pt := case v_key
    when '0'  then 'Entrega de flores por agendar'
    when '1'  then 'Entrega das flores agendada'
    when '2'  then 'Flores recebidas'
    when '3'  then 'Flores na prensa'
    when '4'  then 'Reconstrução botânica'
    when '5'  then 'A compor o design do quadro'
    when '6'  then 'A aguardar aprovação da composição'
    when '7'  then 'A finalizar o quadro'
    when '8'  then 'A ser emoldurado'
    when '9'  then 'A ser fotografado'
    when '10' then 'Quadro pronto'
    when '11' then 'Quadro enviado'
    when '12' then 'Quadro recebido'
    when 'cancelada' then 'Cancelada'
  end;
  v_label_en := case v_key
    when '0'  then 'Flower delivery to be scheduled'
    when '1'  then 'Flower delivery scheduled'
    when '2'  then 'Flowers received'
    when '3'  then 'Flowers in the press'
    when '4'  then 'Botanical reconstruction'
    when '5'  then 'Designing the artwork'
    when '6'  then 'Awaiting design approval'
    when '7'  then 'Finalising the artwork'
    when '8'  then 'Being framed'
    when '9'  then 'Being photographed'
    when '10' then 'Artwork ready'
    when '11' then 'Artwork shipped'
    when '12' then 'Artwork received'
    when 'cancelada' then 'Cancelled'
  end;

  -- ── mensagens default (fallback quando não há override) ────
  v_def_pt := case v_key
    when '0'  then 'A sua reserva foi recebida. Estamos a coordenar consigo a melhor forma de receber as flores.'
    when '1'  then 'O primeiro passo para eternizar a sua memória! Já reservámos o nosso calendário para receber as suas flores.'
    when '2'  then 'As suas flores já chegaram ao nosso atelier! Vamos agora iniciar o processo de tratamento e preservação para que durem para sempre.'
    when '3'  then 'As suas flores estão agora a ser preservadas. Este passo é o segredo para que fiquem deslumbrantes durante muitos anos. Estamos a cuidar de todo o processo e garantimos que a espera vai valer a pena, vão ficar lindas!'
    when '4'  then 'Algumas flores exigem um cuidado extra e estão a ser reconstruídas pétala a pétala para recuperarem a sua forma original.'
    when '5'  then 'Com as flores devidamente preservadas, iniciámos o estudo artístico da composição para criar um design harmonioso.'
    when '6'  then 'A proposta de composição do seu quadro está pronta para ser validada por si. Assim que estiver feliz com o resultado, procederemos à colagem definitiva.'
    when '7'  then 'A composição foi aprovada! Estamos agora a finalizar o seu quadro com a colagem definitiva, antes de seguir para a moldura.'
    when '8'  then 'O seu quadro seguiu para uma casa de molduras profissional em Coimbra. Todas as nossas molduras são feitas à medida, num processo que pode demorar até 15 dias.'
    when '9'  then 'O seu quadro já regressou da molduraria! Estamos agora a fotografar a peça para o nosso registo e redes sociais.'
    when '10' then 'A sua peça está terminada e o resultado ficou deslumbrante! Estamos a preparar a embalagem.'
    when '11' then 'Boas notícias: a sua memória já está a caminho de casa!'
    when '12' then 'Esperamos que tenha adorado o resultado final. Obrigado por nos confiar estas flores tão especiais! Se teve uma boa experiência connosco, deixe-nos o seu feedback e uma foto da peça final no nosso perfil: https://maps.app.goo.gl/qGGdyE8mo2kdNBmm7'
    when 'cancelada' then 'Esta encomenda foi cancelada. Se tem alguma dúvida ou pretende retomar o processo, contacte-nos por email para info@floresabeirario.pt.'
  end;
  v_def_en := case v_key
    when '0'  then 'Your reservation has been received. We are coordinating with you the best way to receive the flowers.'
    when '1'  then 'The first step to eternalizing your memory! We have already reserved our calendar to receive your flowers.'
    when '2'  then 'Your flowers have arrived at our studio! We will now begin the treatment and preservation process so they can last forever.'
    when '3'  then 'Your flowers are now being preserved. This step is the secret to keeping them stunning for many years. We are taking care of the whole process and we guarantee the wait will be worth it, they are going to look beautiful!'
    when '4'  then 'Some flowers require extra care and are being reconstructed petal by petal to regain their original shape.'
    when '5'  then 'With the flowers properly preserved, we have begun the artistic study of the composition to create a harmonious design.'
    when '6'  then 'The design proposal for your frame is ready for your validation. Once you are happy with the result, we will proceed with the final mounting.'
    when '7'  then 'Your design has been approved! We are now finalising your artwork with the definitive mounting, before sending it for framing.'
    when '8'  then 'Your artwork has been sent to a professional framing house in Coimbra. All our frames are custom-made, a process that can take up to 15 days.'
    when '9'  then 'Your frame is back from the framer! We are now photographing the piece for our records and social media.'
    when '10' then 'Your piece is finished and the result is stunning! We are preparing the packaging.'
    when '11' then 'Great news: your memory is on its way home!'
    when '12' then 'We hope you loved the final result. Thank you for trusting us with such special flowers! If you had a good experience with us, please leave your feedback and a photo of the final piece on our profile: https://maps.app.goo.gl/qGGdyE8mo2kdNBmm7'
    when 'cancelada' then 'This order has been cancelled. If you have any questions or wish to resume the process, please contact us at info@floresabeirario.pt.'
  end;

  -- ── override global (singleton public_status_settings.messages) ──
  -- Estrutura: { "<key>": { "pt": "...", "en": "..." } }
  select messages into v_global from public.public_status_settings where id = 1;

  -- resolução: override por encomenda → default global → default hardcoded
  v_msg_pt := coalesce(
    nullif(btrim(v_order.public_status_message_pt), ''),
    nullif(btrim(v_global -> v_key ->> 'pt'), ''),
    v_def_pt
  );
  v_msg_en := coalesce(
    nullif(btrim(v_order.public_status_message_en), ''),
    nullif(btrim(v_global -> v_key ->> 'en'), ''),
    v_def_en
  );

  return jsonb_build_object(
    'order_id',                v_order.order_id,
    'display_name',            coalesce(nullif(btrim(v_order.couple_names), ''), v_order.client_name),
    'status',                  v_order.status,
    'language',                coalesce(v_order.public_status_language, 'pt'),
    'public_phase',            v_phase,           -- 0..12 ou null
    'is_cancelled',            (v_order.status = 'cancelado'),
    'label_pt',                v_label_pt,
    'label_en',                v_label_en,
    'message_pt',              v_msg_pt,
    'message_en',              v_msg_en,
    'estimated_delivery_date', v_order.estimated_delivery_date,
    'updated_at',              v_order.public_status_updated_at
  );
end;
$$;

-- O site público (fbr-tracking) chama isto com a anon key.
grant execute on function public.get_public_order_status(text) to anon, authenticated;

comment on function public.get_public_order_status(text) is
  'Fonte única da fase pública para os sites públicos (fbr-tracking). Espelha src/lib/public-status.ts; guardado por public-status-sync.test.ts. Ver docs/ECOSYSTEM.md.';
