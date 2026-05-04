// ============================================================
// FBR Admin — Site público status.floresabeirario.pt
//
// Mapeamento entre os estados internos da encomenda e as fases
// públicas que o cliente vê no site de acompanhamento.
//
// Mensagens default extraídas do PDF "plataforma admin"
// (em PT e EN). Podem ser sobrescritas globalmente em
// /status/mensagens-default ou por encomenda na aba /status.
// ============================================================

import type { OrderStatus } from "@/types/database";

// 0  = pré-timeline (a Maria ainda não enviou o link normalmente)
// 1-11 = fases visíveis na timeline pública
// "cancelada" = encomenda cancelada (mostrada à parte da timeline)
export type PublicPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | "cancelada";

// Lista ordenada das fases que aparecem na timeline pública.
// Não inclui 0 nem "cancelada".
export const PUBLIC_TIMELINE_PHASES: PublicPhase[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
];

// Todas as fases possíveis (para selects e filtros).
export const ALL_PUBLIC_PHASES: PublicPhase[] = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, "cancelada",
];

// ── Mapeamento estado interno → fase pública ─────────────────
//
// Notas importantes do PDF:
//   • flores_enviadas → fase 1 (cliente continua a ver "agendada")
//   • emoldurado      → fase 7 (cliente continua a ver "a ser emoldurado")
//   • cancelado       → "cancelada" (NÃO regride a fase 0 como o PDF
//     sugeria; ver project_status_excel_coexistence.md e a discussão
//     com a Maria na sessão 13)
export const STATUS_TO_PUBLIC_PHASE: Record<OrderStatus, PublicPhase> = {
  entrega_flores_agendar: 0,
  entrega_agendada:       1,
  flores_enviadas:        1,
  flores_recebidas:       2,
  flores_na_prensa:       3,
  reconstrucao_botanica:  4,
  a_compor_design:        5,
  a_aguardar_aprovacao:   6,
  a_ser_emoldurado:       7,
  emoldurado:             7,
  a_ser_fotografado:      8,
  quadro_pronto:          9,
  quadro_enviado:         10,
  quadro_recebido:        11,
  cancelado:              "cancelada",
};

// ── Labels da fase pública (PT + EN) ──────────────────────────
export const PUBLIC_PHASE_LABEL_PT: Record<PublicPhase, string> = {
  0:  "Entrega de flores por agendar",
  1:  "Entrega das flores agendada",
  2:  "Flores recebidas",
  3:  "Flores na prensa",
  4:  "Reconstrução botânica",
  5:  "A compor o design do quadro",
  6:  "A aguardar aprovação da composição",
  7:  "A ser emoldurado",
  8:  "A ser fotografado",
  9:  "Quadro pronto",
  10: "Quadro enviado",
  11: "Quadro recebido",
  cancelada: "Cancelada",
};

export const PUBLIC_PHASE_LABEL_EN: Record<PublicPhase, string> = {
  0:  "Flower delivery to be scheduled",
  1:  "Flower delivery scheduled",
  2:  "Flowers received",
  3:  "Flowers in the press",
  4:  "Botanical reconstruction",
  5:  "Designing the artwork",
  6:  "Awaiting design approval",
  7:  "Being framed",
  8:  "Being photographed",
  9:  "Artwork ready",
  10: "Artwork shipped",
  11: "Artwork received",
  cancelada: "Cancelled",
};

// ── Cores associadas a cada fase pública (badges/timeline) ────
// Tons que reforçam a progressão: amber → blue → purple → orange
// → green. "Cancelada" em rose neutro.
export const PUBLIC_PHASE_COLORS: Record<PublicPhase, string> = {
  0:  "bg-stone-100 text-stone-700 border-stone-200",
  1:  "bg-amber-100 text-amber-800 border-amber-200",
  2:  "bg-sky-100 text-sky-800 border-sky-200",
  3:  "bg-blue-100 text-blue-800 border-blue-200",
  4:  "bg-indigo-100 text-indigo-800 border-indigo-200",
  5:  "bg-violet-100 text-violet-800 border-violet-200",
  6:  "bg-purple-100 text-purple-800 border-purple-200",
  7:  "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
  8:  "bg-pink-100 text-pink-800 border-pink-200",
  9:  "bg-orange-100 text-orange-800 border-orange-200",
  10: "bg-emerald-100 text-emerald-800 border-emerald-200",
  11: "bg-green-100 text-green-800 border-green-200",
  cancelada: "bg-rose-100 text-rose-800 border-rose-200",
};

// ── Mensagens default (extraídas do PDF) ──────────────────────
// Podem ser sobrescritas globalmente via tabela `public_status_settings`.
export const DEFAULT_MESSAGES_PT: Record<PublicPhase, string> = {
  0:
    "A sua reserva foi recebida. Estamos a coordenar consigo a melhor forma de receber as flores.",
  1:
    "O primeiro passo para eternizar a sua memória! Já reservámos o nosso calendário para receber o seu bouquet.",
  2:
    "As suas flores já chegaram ao nosso atelier! Vamos agora iniciar o processo de tratamento e preservação para que durem para sempre.",
  3:
    "As suas flores estão agora a ser preservadas. Este passo é o segredo para que fiquem deslumbrantes durante muitos anos. Estamos a cuidar de todo o processo e garantimos que a espera vai valer a pena, vão ficar lindas!",
  4:
    "Algumas flores exigem um cuidado extra e estão a ser reconstruídas pétala a pétala para recuperarem a sua forma original.",
  5:
    "Com as flores devidamente preservadas, iniciámos o estudo artístico da composição para criar um design harmonioso.",
  6:
    "A proposta de composição do seu quadro está pronta para ser validada por si. Assim que estiver feliz com o resultado, procederemos à colagem definitiva.",
  7:
    "O seu quadro seguiu para uma casa de molduras profissional em Coimbra. Todas as nossas molduras são feitas à medida, num processo que pode demorar até 15 dias.",
  8:
    "O seu quadro já regressou da molduraria! Estamos agora a fotografar a peça para o nosso registo e redes sociais.",
  9:
    "A sua peça está terminada e o resultado ficou deslumbrante! Estamos a preparar a embalagem.",
  10:
    "Boas notícias: a sua memória já está a caminho de casa!",
  11:
    "Esperamos que tenha adorado o resultado final. Obrigado por nos confiar estas flores tão especiais! Se teve uma boa experiência connosco, deixe-nos o seu feedback e uma foto da peça final no nosso perfil: https://maps.app.goo.gl/qGGdyE8mo2kdNBmm7",
  cancelada:
    "Esta encomenda foi cancelada. Se tem alguma dúvida ou pretende retomar o processo, contacte-nos por email para info@floresabeirario.pt.",
};

export const DEFAULT_MESSAGES_EN: Record<PublicPhase, string> = {
  0:
    "Your reservation has been received. We are coordinating with you the best way to receive the flowers.",
  1:
    "The first step to eternalizing your memory! We have already reserved our calendar to receive your bouquet.",
  2:
    "Your flowers have arrived at our studio! We will now begin the treatment and preservation process so they can last forever.",
  3:
    "Your flowers are now being preserved. This step is the secret to keeping them stunning for many years. We are taking care of the whole process and we guarantee the wait will be worth it, they are going to look beautiful!",
  4:
    "Some flowers require extra care and are being reconstructed petal by petal to regain their original shape.",
  5:
    "With the flowers properly preserved, we have begun the artistic study of the composition to create a harmonious design.",
  6:
    "The design proposal for your frame is ready for your validation. Once you are happy with the result, we will proceed with the final mounting.",
  7:
    "Your artwork has been sent to a professional framing house in Coimbra. All our frames are custom-made, a process that can take up to 15 days.",
  8:
    "Your frame is back from the framer! We are now photographing the piece for our records and social media.",
  9:
    "Your piece is finished and the result is stunning! We are preparing the packaging.",
  10:
    "Great news: your memory is on its way home!",
  11:
    "We hope you loved the final result. Thank you for trusting us with such special flowers! If you had a good experience with us, please leave your feedback and a photo of the final piece on our profile: https://maps.app.goo.gl/qGGdyE8mo2kdNBmm7",
  cancelada:
    "This order has been cancelled. If you have any questions or wish to resume the process, please contact us at info@floresabeirario.pt.",
};

// ── Helpers ──────────────────────────────────────────────────

export function getPublicPhase(status: OrderStatus): PublicPhase {
  return STATUS_TO_PUBLIC_PHASE[status];
}

export function getPublicLabel(phase: PublicPhase, lang: "pt" | "en"): string {
  return lang === "pt" ? PUBLIC_PHASE_LABEL_PT[phase] : PUBLIC_PHASE_LABEL_EN[phase];
}

/**
 * Devolve a mensagem efectiva: se houver override por encomenda,
 * usa-a; caso contrário, usa o default global (que pode também
 * ter sido editado pelo admin via settings).
 */
export function resolveMessage(
  phase: PublicPhase,
  lang: "pt" | "en",
  perOrderOverride: string | null | undefined,
  globalDefaults?: PartialPublicMessages,
): string {
  if (perOrderOverride && perOrderOverride.trim()) return perOrderOverride;
  const fromGlobal = globalDefaults?.[phase]?.[lang];
  if (fromGlobal && fromGlobal.trim()) return fromGlobal;
  return lang === "pt" ? DEFAULT_MESSAGES_PT[phase] : DEFAULT_MESSAGES_EN[phase];
}

// Estrutura usada na tabela `public_status_settings.messages`.
export type PartialPublicMessages = Partial<
  Record<PublicPhase, { pt?: string; en?: string }>
>;

// URL para o site público.
export function publicStatusUrl(orderId: string): string {
  return `https://status.floresabeirario.pt/${orderId}`;
}
