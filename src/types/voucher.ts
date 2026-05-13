// ============================================================
// FBR Admin — Tipos TypeScript para vales-presente
// ============================================================

import type {
  ContactPreference,
  FormLanguage,
  HowFoundFBR,
  PartnerCommissionStatus,
} from "./database";

// Pagamento (vales só têm 2 estados, vs. 4 da Preservação)
export type VoucherPaymentStatus = "100_pago" | "100_por_pagar";

// Envio do vale ao destinatário
export type VoucherSendStatus = "enviado" | "agendado" | "nao_agendado";

// Utilização do vale (cliente já agendou preservação?)
export type VoucherUsageStatus =
  | "preservacao_agendada"
  | "preservacao_nao_agendada";

// A quem entregar o vale
export type VoucherDeliveryRecipient = "remetente" | "destinatario";

// Formato de entrega
export type VoucherDeliveryFormat = "digital" | "fisico";

// Canal digital (só relevante se delivery_format=digital)
export type VoucherDeliveryChannel = "email" | "whatsapp";

// Tipo completo de um vale (corresponde à tabela vouchers)
export interface Voucher {
  id: string;
  code: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;

  // Remetente
  sender_name: string;
  sender_contact_pref: ContactPreference | null;
  sender_email: string | null;
  sender_phone: string | null;

  // O vale
  recipient_name: string;
  message: string | null;
  amount: number;

  // Entrega
  delivery_recipient: VoucherDeliveryRecipient | null;
  delivery_format: VoucherDeliveryFormat | null;
  delivery_channel: VoucherDeliveryChannel | null;
  delivery_shipping_cost: number | null;
  // Quando entrega vai diretamente para o destinatário:
  recipient_contact: string | null;   // email ou WhatsApp (se digital)
  recipient_address: string | null;   // morada (se físico)
  ideal_send_date: string | null;     // data ideal de envio (opcional)

  // Outros
  comments: string | null;
  how_found_fbr: HowFoundFBR | null;
  how_found_fbr_other: string | null;
  form_language: FormLanguage;

  // Estado admin
  payment_status: VoucherPaymentStatus;
  send_status: VoucherSendStatus;
  scheduled_send_date: string | null;
  usage_status: VoucherUsageStatus;
  expiry_date: string;

  // Fatura
  nif: string | null;
  needs_invoice: boolean;
  invoice_attachment_url: string | null;

  // ── RGPD (preenchido por submissões do form público) ────────
  consent_at: string | null;
  consent_version: string | null;
  consent_ip: string | null;

  // ── Parcerias (a partir da migração 018) ────────────────────
  partner_id: string | null;
  partner_commission: number | null;
  partner_commission_status: PartnerCommissionStatus;

  // ── Sticky note (post-it amarelo flutuante no workbench) ────
  sticky_note: string | null;
}

// Tipo para criar — code é gerado pelo trigger, expiry pelo default
export type VoucherInsert = Partial<
  Omit<Voucher, "id" | "code" | "created_at" | "updated_at">
> & {
  sender_name: string;
  recipient_name: string;
  amount: number;
};

// Tipo para actualizar
export type VoucherUpdate = Partial<Omit<Voucher, "id" | "created_at">>;

// ── Agrupamento visual ────────────────────────────────────────
// Spec: Pré-reservas (100% por pagar) / Reservas (100% pago)

export type VoucherGroup = "pre_reservas" | "reservas";

export interface VoucherGroupConfig {
  id: VoucherGroup;
  label: string;
  color: string; // classe tailwind
}

export const VOUCHER_GROUPS: VoucherGroupConfig[] = [
  { id: "pre_reservas", label: "Pré-reservas", color: "text-amber-600" },
  { id: "reservas", label: "Reservas", color: "text-emerald-600" },
];

// ── Labels ────────────────────────────────────────────────────

export const VOUCHER_PAYMENT_STATUS_LABELS: Record<VoucherPaymentStatus, string> = {
  "100_pago": "100% pago",
  "100_por_pagar": "100% por pagar",
};

export const VOUCHER_PAYMENT_STATUS_COLORS: Record<VoucherPaymentStatus, string> = {
  "100_pago":      "bg-emerald-100 text-emerald-800 border-emerald-300",
  "100_por_pagar": "bg-rose-100 text-rose-800 border-rose-300",
};

export const VOUCHER_SEND_STATUS_LABELS: Record<VoucherSendStatus, string> = {
  enviado: "Enviado",
  agendado: "Agendado",
  nao_agendado: "Não agendado",
};

export const VOUCHER_SEND_STATUS_COLORS: Record<VoucherSendStatus, string> = {
  enviado:      "bg-emerald-100 text-emerald-800 border-emerald-300",
  agendado:     "bg-sky-100 text-sky-800 border-sky-300",
  nao_agendado: "bg-gray-100 text-gray-700 border-gray-300",
};

export const VOUCHER_USAGE_STATUS_LABELS: Record<VoucherUsageStatus, string> = {
  preservacao_agendada: "Preservação agendada",
  preservacao_nao_agendada: "Preservação não agendada",
};

export const VOUCHER_USAGE_STATUS_COLORS: Record<VoucherUsageStatus, string> = {
  preservacao_agendada:     "bg-violet-100 text-violet-800 border-violet-300",
  preservacao_nao_agendada: "bg-amber-100 text-amber-800 border-amber-300",
};

export const VOUCHER_DELIVERY_RECIPIENT_LABELS: Record<VoucherDeliveryRecipient, string> = {
  remetente: "Mim (remetente)",
  destinatario: "Diretamente ao destinatário",
};

export const VOUCHER_DELIVERY_FORMAT_LABELS: Record<VoucherDeliveryFormat, string> = {
  digital: "Digital — por email ou WhatsApp (gratuito)",
  fisico: "Físico — cartão com envelope (9€ + portes)",
};

export const VOUCHER_DELIVERY_CHANNEL_LABELS: Record<VoucherDeliveryChannel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

// Custo base de envio físico (€)
export const VOUCHER_PHYSICAL_BASE_COST = 9;
