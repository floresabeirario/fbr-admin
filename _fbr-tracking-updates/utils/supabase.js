// ============================================================
// fbr-tracking — leitor do Supabase (substitui googleSheets.js)
//
// Mantém o mesmo contrato de saída de `getEncomendaById(id)` que
// a versão antiga do Google Sheets, para o resto do código não
// precisar de mudar:
//   {
//     id, nome_encomenda,
//     fase, fase_en, fase_numero,
//     mensagem, mensagem_en,
//     ultima_atualizacao,
//     data_entrega,
//   }
//
// A lógica de mapeamento estado→fase pública, labels e mensagens
// default está espelhada em `src/lib/public-status.ts` no repo
// admin (fbr-admin2). Se alguma das duas mudar, actualizar ambas.
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ── Estado interno → fase pública ────────────────────────────
// 0       = pré-timeline (a Maria ainda não enviou o link normalmente)
// 1-12    = fases visíveis na timeline pública
// 'cancelada' = encomenda cancelada (mostrada à parte da timeline)
const STATUS_TO_PUBLIC_PHASE = {
  entrega_flores_agendar: 0,
  entrega_agendada:       1,
  flores_enviadas:        1,
  flores_recebidas:       2,
  flores_na_prensa:       3,
  reconstrucao_botanica:  4,
  a_compor_design:        5,
  a_aguardar_aprovacao:   6,
  a_finalizar_quadro:     7,
  a_ser_emoldurado:       8,
  emoldurado:             8,
  a_ser_fotografado:      9,
  quadro_pronto:         10,
  quadro_enviado:        11,
  quadro_recebido:       12,
  cancelado: 'cancelada',
};

const PUBLIC_PHASE_LABEL_PT = {
  0:  'Entrega de flores por agendar',
  1:  'Entrega das flores agendada',
  2:  'Flores recebidas',
  3:  'Flores na prensa',
  4:  'Reconstrução botânica',
  5:  'A compor o design do quadro',
  6:  'A aguardar aprovação da composição',
  7:  'A finalizar o quadro',
  8:  'A ser emoldurado',
  9:  'A ser fotografado',
  10: 'Quadro pronto',
  11: 'Quadro enviado',
  12: 'Quadro recebido',
  cancelada: 'Cancelada',
};

const PUBLIC_PHASE_LABEL_EN = {
  0:  'Flower delivery to be scheduled',
  1:  'Flower delivery scheduled',
  2:  'Flowers received',
  3:  'Flowers in the press',
  4:  'Botanical reconstruction',
  5:  'Designing the artwork',
  6:  'Awaiting design approval',
  7:  'Finalising the artwork',
  8:  'Being framed',
  9:  'Being photographed',
  10: 'Artwork ready',
  11: 'Artwork shipped',
  12: 'Artwork received',
  cancelada: 'Cancelled',
};

const DEFAULT_MESSAGES_PT = {
  0:  'A sua reserva foi recebida. Estamos a coordenar consigo a melhor forma de receber as flores.',
  1:  'O primeiro passo para eternizar a sua memória! Já reservámos o nosso calendário para receber o seu bouquet.',
  2:  'As suas flores já chegaram ao nosso atelier! Vamos agora iniciar o processo de tratamento e preservação para que durem para sempre.',
  3:  'As suas flores estão agora a ser preservadas. Este passo é o segredo para que fiquem deslumbrantes durante muitos anos. Estamos a cuidar de todo o processo e garantimos que a espera vai valer a pena, vão ficar lindas!',
  4:  'Algumas flores exigem um cuidado extra e estão a ser reconstruídas pétala a pétala para recuperarem a sua forma original.',
  5:  'Com as flores devidamente preservadas, iniciámos o estudo artístico da composição para criar um design harmonioso.',
  6:  'A proposta de composição do seu quadro está pronta para ser validada por si. Assim que estiver feliz com o resultado, procederemos à colagem definitiva.',
  7:  'A composição foi aprovada! Estamos agora a finalizar o seu quadro com a colagem definitiva, antes de seguir para a moldura.',
  8:  'O seu quadro seguiu para uma casa de molduras profissional em Coimbra. Todas as nossas molduras são feitas à medida, num processo que pode demorar até 15 dias.',
  9:  'O seu quadro já regressou da molduraria! Estamos agora a fotografar a peça para o nosso registo e redes sociais.',
  10: 'A sua peça está terminada e o resultado ficou deslumbrante! Estamos a preparar a embalagem.',
  11: 'Boas notícias: a sua memória já está a caminho de casa!',
  12: 'Esperamos que tenha adorado o resultado final. Obrigado por nos confiar estas flores tão especiais! Se teve uma boa experiência connosco, deixe-nos o seu feedback e uma foto da peça final no nosso perfil: https://maps.app.goo.gl/qGGdyE8mo2kdNBmm7',
  cancelada: 'Esta encomenda foi cancelada. Se tem alguma dúvida ou pretende retomar o processo, contacte-nos por email para info@floresabeirario.pt.',
};

const DEFAULT_MESSAGES_EN = {
  0:  'Your reservation has been received. We are coordinating with you the best way to receive the flowers.',
  1:  'The first step to eternalizing your memory! We have already reserved our calendar to receive your bouquet.',
  2:  'Your flowers have arrived at our studio! We will now begin the treatment and preservation process so they can last forever.',
  3:  'Your flowers are now being preserved. This step is the secret to keeping them stunning for many years. We are taking care of the whole process and we guarantee the wait will be worth it, they are going to look beautiful!',
  4:  'Some flowers require extra care and are being reconstructed petal by petal to regain their original shape.',
  5:  'With the flowers properly preserved, we have begun the artistic study of the composition to create a harmonious design.',
  6:  'The design proposal for your frame is ready for your validation. Once you are happy with the result, we will proceed with the final mounting.',
  7:  'Your design has been approved! We are now finalising your artwork with the definitive mounting, before sending it for framing.',
  8:  'Your artwork has been sent to a professional framing house in Coimbra. All our frames are custom-made, a process that can take up to 15 days.',
  9:  'Your frame is back from the framer! We are now photographing the piece for our records and social media.',
  10: 'Your piece is finished and the result is stunning! We are preparing the packaging.',
  11: 'Great news: your memory is on its way home!',
  12: 'We hope you loved the final result. Thank you for trusting us with such special flowers! If you had a good experience with us, please leave your feedback and a photo of the final piece on our profile: https://maps.app.goo.gl/qGGdyE8mo2kdNBmm7',
  cancelada: 'This order has been cancelled. If you have any questions or wish to resume the process, please contact us at info@floresabeirario.pt.',
};

// ── Helpers ──────────────────────────────────────────────────

function resolveMessage(phase, lang, perOrderOverride, globalDefaults) {
  if (perOrderOverride && perOrderOverride.trim()) return perOrderOverride;
  const fromGlobal = globalDefaults && globalDefaults[phase] && globalDefaults[phase][lang];
  if (fromGlobal && fromGlobal.trim()) return fromGlobal;
  return lang === 'pt' ? DEFAULT_MESSAGES_PT[phase] : DEFAULT_MESSAGES_EN[phase];
}

// "2026-05-04" → "maio de 2026" (PT) / "May 2026" (EN)
// Mês + ano apenas (consistente com formatPublicEstimatedDelivery
// em src/lib/public-status.ts — a entrega real não é dia-exacto).
function formatEstimatedDelivery(dateIso, lang) {
  if (!dateIso) return '';
  const parts = dateIso.split('-');
  if (parts.length < 2) return '';
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month) return '';
  // Dia 15 para evitar saltos de timezone na borda do mês.
  const d = new Date(year, month - 1, 15);
  const locale = lang === 'pt' ? 'pt-PT' : 'en-GB';
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
}

// "2026-05-04T08:30:00Z" → "04/05/2026, 08:30" (pt-PT)
function formatUpdatedAt(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  const time = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${date}, ${time}`;
}

// ── API principal ────────────────────────────────────────────

async function getEncomendaById(id) {
  // 1. Encontrar a encomenda. A column-level GRANT garante que só
  //    obtemos as colunas públicas; a policy garante que só vemos
  //    encomendas pagas e não arquivadas.
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select(`
      order_id,
      client_name,
      couple_names,
      status,
      public_status_message_pt,
      public_status_message_en,
      public_status_language,
      estimated_delivery_date,
      public_status_updated_at
    `)
    .eq('order_id', id)
    .maybeSingle();

  if (orderErr) {
    console.error('Erro ao ler encomenda do Supabase:', orderErr.message);
    throw orderErr;
  }
  if (!order) return null;

  // 2. Ler mensagens default globais (singleton). Best-effort:
  //    se falhar, caímos nos defaults hardcoded.
  let globalDefaults = null;
  const { data: settings } = await supabase
    .from('public_status_settings')
    .select('messages')
    .eq('id', 1)
    .maybeSingle();
  if (settings && settings.messages) globalDefaults = settings.messages;

  // 3. Resolver fase pública.
  const phase = STATUS_TO_PUBLIC_PHASE[order.status];
  if (phase === undefined) {
    // Estado desconhecido (BD à frente do código). Tratamos como
    // pré-timeline para não rebentar o site.
    console.error(`Estado desconhecido em orders.status: ${order.status}`);
  }
  const safePhase = phase === undefined ? 0 : phase;

  // 4. Aplicar idioma escolhido pela Maria na aba Status.
  const lang = order.public_status_language || 'pt';
  const showPt = lang === 'pt' || lang === 'ambos';
  const showEn = lang === 'en' || lang === 'ambos';

  // 5. fase_numero: só preenchido para fases 1-12. Pré-timeline (0)
  //    e cancelada não têm passo na timeline.
  const fase_numero = typeof safePhase === 'number' && safePhase >= 1 && safePhase <= 12
    ? safePhase
    : null;

  // 6. Mensagens efectivas (override → global default → hardcoded).
  const mensagemPt = showPt ? resolveMessage(safePhase, 'pt', order.public_status_message_pt, globalDefaults) : null;
  const mensagemEn = showEn ? resolveMessage(safePhase, 'en', order.public_status_message_en, globalDefaults) : null;

  // 7. Data prevista: sem dia (mês + ano apenas).
  const dataEntregaPt = showPt ? formatEstimatedDelivery(order.estimated_delivery_date, 'pt') : '';
  const dataEntregaEn = showEn ? formatEstimatedDelivery(order.estimated_delivery_date, 'en') : '';
  const data_entrega = showPt && showEn && dataEntregaPt && dataEntregaEn
    ? `${dataEntregaPt} / ${dataEntregaEn}`
    : (dataEntregaPt || dataEntregaEn || '');

  // 8. Nome a mostrar: prioriza nome dos noivos quando existe
  //    (casamentos), caindo no nome da encomenda para os restantes
  //    tipos de evento. Mantém o contrato `nome_encomenda` para o
  //    resto do código (pages/[id].js) não precisar de mudar.
  const nomeAExibir = (order.couple_names && order.couple_names.trim())
    ? order.couple_names.trim()
    : order.client_name;

  return {
    id: order.order_id,
    nome_encomenda: nomeAExibir,
    fase: showPt ? PUBLIC_PHASE_LABEL_PT[safePhase] : null,
    fase_en: showEn ? PUBLIC_PHASE_LABEL_EN[safePhase] : null,
    fase_numero,
    mensagem: mensagemPt,
    mensagem_en: mensagemEn,
    ultima_atualizacao: formatUpdatedAt(order.public_status_updated_at),
    data_entrega,
  };
}

module.exports = { getEncomendaById };
