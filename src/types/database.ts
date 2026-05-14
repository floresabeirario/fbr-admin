// ============================================================
// FBR Admin — Tipos TypeScript para a base de dados Supabase
// ============================================================

export type OrderStatus =
  | "entrega_flores_agendar"
  | "entrega_agendada"
  | "flores_enviadas"
  | "flores_recebidas"
  | "flores_na_prensa"
  | "reconstrucao_botanica"
  | "a_compor_design"
  | "a_aguardar_aprovacao"
  | "a_finalizar_quadro"
  | "a_ser_emoldurado"
  | "emoldurado"
  | "a_ser_fotografado"
  | "quadro_pronto"
  | "quadro_enviado"
  | "quadro_recebido"
  | "cancelado";

export type PaymentStatus =
  | "100_pago"
  | "70_pago"
  | "30_pago"
  | "100_por_pagar";

export type EventType =
  | "casamento"
  | "batizado"
  | "funeral"
  | "pedido_casamento"
  | "outro";

export type ContactPreference = "whatsapp" | "email";

export type FlowerDeliveryMethod = "maos" | "ctt" | "recolha_evento" | "nao_sei";
export type FrameDeliveryMethod = "maos" | "ctt" | "nao_sei";

export type FrameBackground =
  | "transparente"
  | "preto"
  | "branco"
  | "fotografia"
  | "cor"
  | "voces_a_escolher"
  | "nao_sei";

export type FrameSize = "30x40" | "40x50" | "50x70" | "voces_a_escolher" | "nao_sei";

export type YesNoInfo = "sim" | "nao" | "mais_info";

export type HowFoundFBR =
  | "instagram"
  | "facebook"
  | "casamentos_pt"
  | "google"
  | "vale_presente"
  | "florista"
  | "recomendacao"
  | "recomendacao_ia"
  | "outro";

export type PartnerCommissionStatus =
  | "na"
  | "parceiro_informado"
  | "a_aguardar"
  | "paga"
  | "a_aguardar_resposta"
  | "nao_aceita";

export type CouponStatus = "utilizado" | "nao_utilizado" | "na";

export type ClientFeedbackStatus = "deu_feedback" | "ja_pedido" | "nao_disse_nada" | "na";

export type FormLanguage = "pt" | "en";

// Idioma a mostrar ao cliente no site público de status.
export type PublicStatusLanguage = "pt" | "en" | "ambos";

export interface InspirationItem {
  type: "image" | "link";
  url: string;
  label?: string;
}

export interface ExtrasInFrame {
  options: string[];
  notes: string;
}

// Item do inventário de flores em cada encomenda
export interface InventoryItem {
  qty: number;
  name: string;     // ex: "rosas laranja", "papoilas vermelhas"
}

// Tipo completo de uma encomenda (corresponde à tabela orders)
export interface Order {
  id: string;
  order_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;

  // Campos do cliente
  client_name: string;
  contact_preference: ContactPreference | null;
  email: string | null;
  phone: string | null;
  event_date: string | null;
  event_type: EventType | null;
  couple_names: string | null;
  event_location: string | null;
  flower_delivery_method: FlowerDeliveryMethod | null;
  flower_type: string | null;
  frame_delivery_method: FrameDeliveryMethod | null;
  frame_background: FrameBackground | null;
  frame_size: FrameSize | null;
  extras_in_frame: ExtrasInFrame;
  extra_small_frames: YesNoInfo | null;
  extra_small_frames_qty: number | null;
  christmas_ornaments: YesNoInfo | null;
  christmas_ornaments_qty: number | null;
  necklace_pendants: YesNoInfo | null;
  necklace_pendants_qty: number | null;
  how_found_fbr: HowFoundFBR | null;
  how_found_fbr_other: string | null;
  gift_voucher_code: string | null;
  additional_notes: string | null;
  form_language: FormLanguage;

  // Campos admin
  status: OrderStatus;
  contacted: boolean;
  manually_no_response: boolean;
  budget: number | null;
  payment_status: PaymentStatus;
  nif: string | null;
  needs_invoice: boolean;
  invoice_attachment_url: string | null;
  partner_id: string | null;
  partner_commission: number | null;
  partner_commission_status: PartnerCommissionStatus;
  flower_shipping_cost: number | null;
  flower_shipping_paid: boolean;
  frame_shipping_cost: number | null;
  frame_shipping_paid: boolean;
  coupon_code: string | null;
  coupon_expiry: string | null;
  coupon_status: CouponStatus;
  client_feedback_status: ClientFeedbackStatus;
  frame_delivery_date: string | null;
  drive_folder_url: string | null;
  drive_folder_id: string | null;
  calendar_event_id: string | null;
  flowers_photo_url: string | null;
  inspiration_gallery: InspirationItem[];

  // ── Status público (site status.floresabeirario.pt) ─────────
  public_status_message_pt: string | null;
  public_status_message_en: string | null;
  public_status_language: PublicStatusLanguage;
  estimated_delivery_date: string | null;
  public_status_updated_at: string;

  // ── RGPD (preenchido por submissões do form público) ────────
  consent_at: string | null;
  consent_version: string | null;
  consent_ip: string | null;

  // ── Recolha no local (visível só quando flower_delivery_method = recolha_evento) ─────
  pickup_address: string | null;
  pickup_date: string | null;
  pickup_time_from: string | null;   // HH:MM (TIME)
  pickup_time_to: string | null;     // HH:MM (TIME)

  // ── Inventário de flores ─────────────────────────────────────
  inventory: InventoryItem[];

  // ── Sticky note (post-it amarelo flutuante no workbench) ────
  sticky_note: string | null;

  // ── Lembretes de pagamento (40% e 30%) ──────────────────────
  // true = já lembrei o cliente de pagar essa tranche
  payment_40_requested: boolean;
  payment_30_requested: boolean;

  // ── Resposta do cliente à proposta de composição ───────────
  // Quando true, deixa de aparecer o alerta de "cliente em silêncio"
  // mesmo que estejam ≥4 dias no estado a_aguardar_aprovacao.
  approval_responded: boolean;

  // ── RGPD (anonimização) ────────────────────────────────────
  // Timestamp em que a encomenda foi anonimizada (PII removida,
  // linha mantida para métricas agregadas). NULL = não anonimizada.
  anonymized_at: string | null;
}

// Tipo para criar uma nova encomenda (campos obrigatórios mínimos)
export type OrderInsert = Partial<Omit<Order, "id" | "order_id" | "created_at" | "updated_at">> & {
  client_name: string;
};

// Tipo para actualizar uma encomenda existente.
// `order_id` é editável (admin pode corrigir IDs ao importar encomendas
// antigas). `id` (UUID) e `created_at` continuam imutáveis.
export type OrderUpdate = Partial<Omit<Order, "id" | "created_at">>;

// ── Agrupamento visual de estados ────────────────────────────

export type OrderGroup =
  | "pre_reservas"
  | "sem_resposta"
  | "reservas"
  | "preservacao_design"
  | "finalizacao"
  | "concluidos"
  | "cancelamentos";

export interface OrderGroupConfig {
  id: OrderGroup;
  label: string;
  statuses: OrderStatus[];
  color: string; // classe CSS tailwind de cor
}

export const ORDER_GROUPS: OrderGroupConfig[] = [
  {
    id: "pre_reservas",
    label: "Pré-reservas",
    statuses: ["entrega_flores_agendar"],
    color: "text-amber-600",
  },
  {
    id: "sem_resposta",
    label: "Sem resposta",
    statuses: ["entrega_flores_agendar"],
    color: "text-red-600",
  },
  {
    id: "reservas",
    label: "Reservas",
    statuses: ["entrega_agendada", "flores_enviadas", "flores_recebidas"],
    color: "text-blue-600",
  },
  {
    id: "preservacao_design",
    label: "Preservação e design",
    statuses: [
      "flores_na_prensa",
      "reconstrucao_botanica",
      "a_compor_design",
      "a_aguardar_aprovacao",
      "a_finalizar_quadro",
    ],
    color: "text-purple-600",
  },
  {
    id: "finalizacao",
    label: "Finalização",
    statuses: [
      "a_ser_emoldurado",
      "emoldurado",
      "a_ser_fotografado",
      "quadro_pronto",
      "quadro_enviado",
    ],
    color: "text-orange-600",
  },
  {
    id: "concluidos",
    label: "Concluídos",
    statuses: ["quadro_recebido"],
    color: "text-green-600",
  },
  {
    id: "cancelamentos",
    label: "Cancelamentos",
    statuses: ["cancelado"],
    color: "text-gray-500",
  },
];

// ── Labels legíveis para cada estado ─────────────────────────

export const STATUS_LABELS: Record<OrderStatus, string> = {
  entrega_flores_agendar: "Entrega de flores por agendar",
  entrega_agendada: "Entrega agendada",
  flores_enviadas: "Flores enviadas",
  flores_recebidas: "Flores recebidas",
  flores_na_prensa: "Flores na prensa",
  reconstrucao_botanica: "Reconstrução botânica",
  a_compor_design: "A compor design",
  a_aguardar_aprovacao: "A aguardar aprovação",
  a_finalizar_quadro: "A finalizar o quadro",
  a_ser_emoldurado: "A ser emoldurado",
  emoldurado: "Emoldurado",
  a_ser_fotografado: "A ser fotografado",
  quadro_pronto: "Quadro pronto",
  quadro_enviado: "Quadro enviado",
  quadro_recebido: "Quadro recebido",
  cancelado: "Cancelado",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  "100_pago": "100% pago",
  "70_pago": "70% pago",
  "30_pago": "30% pago",
  "100_por_pagar": "100% por pagar",
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  casamento: "Casamento",
  batizado: "Batizado",
  funeral: "Funeral",
  pedido_casamento: "Pedido de Casamento",
  outro: "Outro",
};

export const CONTACT_PREFERENCE_LABELS: Record<ContactPreference, string> = {
  whatsapp: "WhatsApp",
  email: "Email",
};

export const FLOWER_DELIVERY_METHOD_LABELS: Record<FlowerDeliveryMethod, string> = {
  maos: "Em mãos",
  ctt: "CTT",
  recolha_evento: "Recolha no local",
  nao_sei: "Não sei",
};

// Cores associadas a cada método de envio das flores — para facilitar
// a leitura visual na tabela e no workbench.
export const FLOWER_DELIVERY_METHOD_COLORS: Record<FlowerDeliveryMethod, string> = {
  maos:           "bg-emerald-100 text-emerald-800 border-emerald-300",
  ctt:            "bg-sky-100 text-sky-800 border-sky-300",
  recolha_evento: "bg-violet-100 text-violet-800 border-violet-300",
  nao_sei:        "bg-stone-100 text-stone-700 border-stone-300",
};

export const FRAME_DELIVERY_METHOD_LABELS: Record<FrameDeliveryMethod, string> = {
  maos: "Em mãos",
  ctt: "CTT",
  nao_sei: "Não sei",
};

// Cores associadas a cada método de receção do quadro — espelhadas
// das cores do envio das flores (mãos/CTT) para coerência.
export const FRAME_DELIVERY_METHOD_COLORS: Record<FrameDeliveryMethod, string> = {
  maos:    "bg-emerald-100 text-emerald-800 border-emerald-300",
  ctt:     "bg-sky-100 text-sky-800 border-sky-300",
  nao_sei: "bg-stone-100 text-stone-700 border-stone-300",
};

export const FRAME_BACKGROUND_LABELS: Record<FrameBackground, string> = {
  transparente: "Transparente",
  preto: "Preto",
  branco: "Branco",
  fotografia: "Fotografia",
  cor: "Cor",
  voces_a_escolher: "Vocês a escolher",
  nao_sei: "Não sei",
};

export const FRAME_SIZE_LABELS: Record<FrameSize, string> = {
  "30x40": "30×40",
  "40x50": "40×50",
  "50x70": "50×70",
  voces_a_escolher: "Vocês a escolher",
  nao_sei: "Não sei",
};

// Cores associadas a cada tamanho — gradiente do mais pequeno para o maior,
// indecisos a cinzento.
export const FRAME_SIZE_COLORS: Record<FrameSize, string> = {
  "30x40":          "bg-sky-100 text-sky-800 border-sky-300",
  "40x50":          "bg-violet-100 text-violet-800 border-violet-300",
  "50x70":          "bg-indigo-100 text-indigo-800 border-indigo-300",
  voces_a_escolher: "bg-amber-100 text-amber-800 border-amber-300",
  nao_sei:          "bg-gray-100 text-gray-600 border-gray-300",
};

export const YES_NO_INFO_LABELS: Record<YesNoInfo, string> = {
  sim: "Sim",
  nao: "Não",
  mais_info: "Mais info",
};

export const HOW_FOUND_FBR_LABELS: Record<HowFoundFBR, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  casamentos_pt: "casamentos.pt",
  google: "Google",
  vale_presente: "Vale-Presente",
  florista: "Florista",
  recomendacao: "Recomendação",
  recomendacao_ia: "Recomendação de IA (ChatGPT, Gemini…)",
  outro: "Outro",
};

// Cores associadas a cada plataforma de origem (badge no select).
// O fundo é a cor mais identitária da plataforma; o texto fica legível
// sobre esse fundo.
//
// Especificações da Maria (Fase 5.5):
//   - casamentos.pt → #F16B6B (coral identitário do site casamentos.pt)
//   - Google → fundo branco, letras coloridas (azul/vermelho/amarelo/azul/verde/vermelho — ver
//     `HowFoundFBRBadge` no workbench)
//   - Vale-Presente → #6E7DAF (azul-acinzentado da brand FBR para vales)
//   - Florista → rosa pastel "fofo"
export const HOW_FOUND_FBR_COLORS: Record<HowFoundFBR, string> = {
  instagram:       "bg-gradient-to-r from-pink-500 via-fuchsia-500 to-orange-400 text-white border-transparent",
  facebook:        "bg-blue-600 text-white border-blue-700",
  casamentos_pt:   "bg-[#F16B6B] text-white border-[#D65555]",
  google:          "bg-white text-slate-700 border-slate-300",
  vale_presente:   "bg-[#6E7DAF] text-white border-[#56689E]",
  florista:        "bg-pink-100 text-pink-700 border-pink-200",
  recomendacao:    "bg-purple-100 text-purple-800 border-purple-300",
  recomendacao_ia: "bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500 text-white border-transparent",
  outro:           "bg-slate-100 text-slate-700 border-slate-300",
};

// "Google" tem rendering especial — cada letra na cor original do logo.
// Usado em badges e selects via componente `HowFoundFbrLabel`.
export const GOOGLE_LETTER_COLORS = ["#4285F4", "#EA4335", "#FBBC05", "#4285F4", "#34A853", "#EA4335"]; // G-o-o-g-l-e

export const PARTNER_COMMISSION_STATUS_LABELS: Record<PartnerCommissionStatus, string> = {
  na: "N/A",
  parceiro_informado: "Parceiro informado",
  a_aguardar: "Encomenda não paga na totalidade",
  paga: "Paga",
  a_aguardar_resposta: "A aguardar resposta",
  nao_aceita: "Não aceita",
};

export const PARTNER_COMMISSION_STATUS_COLORS: Record<PartnerCommissionStatus, string> = {
  na:                  "bg-gray-100 text-gray-600 border-gray-200",
  parceiro_informado:  "bg-sky-100 text-sky-800 border-sky-200",
  a_aguardar:          "bg-amber-100 text-amber-800 border-amber-200",
  paga:                "bg-emerald-100 text-emerald-800 border-emerald-200",
  a_aguardar_resposta: "bg-yellow-100 text-yellow-800 border-yellow-200",
  nao_aceita:          "bg-rose-100 text-rose-800 border-rose-200",
};

export const COUPON_STATUS_LABELS: Record<CouponStatus, string> = {
  utilizado: "Utilizado",
  nao_utilizado: "Não utilizado",
  na: "N/A",
};

export const COUPON_STATUS_COLORS: Record<CouponStatus, string> = {
  utilizado:     "bg-emerald-100 text-emerald-800 border-emerald-200",
  nao_utilizado: "bg-amber-100 text-amber-800 border-amber-200",
  na:            "bg-gray-100 text-gray-600 border-gray-200",
};

export const CLIENT_FEEDBACK_STATUS_LABELS: Record<ClientFeedbackStatus, string> = {
  deu_feedback: "Deu feedback",
  ja_pedido: "Já pedido",
  nao_disse_nada: "Não disse nada",
  na: "N/A",
};

export const CLIENT_FEEDBACK_STATUS_COLORS: Record<ClientFeedbackStatus, string> = {
  deu_feedback:   "bg-emerald-100 text-emerald-800 border-emerald-200",
  ja_pedido:      "bg-sky-100 text-sky-800 border-sky-200",
  nao_disse_nada: "bg-rose-100 text-rose-800 border-rose-200",
  na:             "bg-gray-100 text-gray-600 border-gray-200",
};

export const FORM_LANGUAGE_LABELS: Record<FormLanguage, string> = {
  pt: "🇵🇹 Português",
  en: "🇬🇧 English",
};

export const PUBLIC_STATUS_LANGUAGE_LABELS: Record<PublicStatusLanguage, string> = {
  pt: "🇵🇹 Só PT",
  en: "🇬🇧 Só EN",
  ambos: "🇵🇹 🇬🇧 Ambos (bilingue)",
};

export const SIM_NAO_LABELS: Record<"sim" | "nao", string> = {
  sim: "Sim",
  nao: "Não",
};

// Tipo para o audit log
export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
}
