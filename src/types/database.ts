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
  | "30_por_pagar"
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

export interface InspirationItem {
  type: "image" | "link";
  url: string;
  label?: string;
}

export interface ExtrasInFrame {
  options: string[];
  notes: string;
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
  gift_voucher_code: string | null;
  additional_notes: string | null;
  form_language: FormLanguage;

  // Campos admin
  status: OrderStatus;
  contacted: boolean;
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
  flowers_photo_url: string | null;
  inspiration_gallery: InspirationItem[];
}

// Tipo para criar uma nova encomenda (campos obrigatórios mínimos)
export type OrderInsert = Partial<Omit<Order, "id" | "order_id" | "created_at" | "updated_at">> & {
  client_name: string;
};

// Tipo para actualizar uma encomenda existente
export type OrderUpdate = Partial<Omit<Order, "id" | "order_id" | "created_at">>;

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
  "30_por_pagar": "30% por pagar",
  "100_por_pagar": "100% por pagar",
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  casamento: "Casamento",
  batizado: "Batizado",
  funeral: "Funeral",
  pedido_casamento: "Pedido de Casamento",
  outro: "Outro",
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
