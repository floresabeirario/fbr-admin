// ============================================================
// Export de encomendas para CSV (abre directamente no Excel).
// O Excel em PT/EU prefere `;` como separador e abre como UTF-8
// quando o ficheiro começa com BOM.
// ============================================================

import {
  type Order,
  STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  CONTACT_PREFERENCE_LABELS,
  FLOWER_DELIVERY_METHOD_LABELS,
  FRAME_DELIVERY_METHOD_LABELS,
  FRAME_BACKGROUND_LABELS,
  FRAME_SIZE_LABELS,
  YES_NO_INFO_LABELS,
  HOW_FOUND_FBR_LABELS,
  PARTNER_COMMISSION_STATUS_LABELS,
  COUPON_STATUS_LABELS,
  CLIENT_FEEDBACK_STATUS_LABELS,
} from "@/types/database";
import {
  type Voucher,
  VOUCHER_PAYMENT_STATUS_LABELS,
  VOUCHER_SEND_STATUS_LABELS,
  VOUCHER_USAGE_STATUS_LABELS,
  VOUCHER_DELIVERY_RECIPIENT_LABELS,
  VOUCHER_DELIVERY_FORMAT_LABELS,
  VOUCHER_DELIVERY_CHANNEL_LABELS,
} from "@/types/voucher";
import {
  type Partner,
  PARTNER_CATEGORY_LABELS,
  PARTNER_STATUS_LABELS,
  PARTNER_ACCEPTS_COMMISSION_LABELS,
} from "@/types/partner";
import { format, parseISO } from "date-fns";

function fmtDate(value: string | null): string {
  if (!value) return "";
  try { return format(parseISO(value), "dd/MM/yyyy"); } catch { return ""; }
}

function fmtDateTime(value: string | null): string {
  if (!value) return "";
  try { return format(parseISO(value), "dd/MM/yyyy HH:mm"); } catch { return ""; }
}

function fmtEuro(value: number | null): string {
  if (value === null || value === undefined) return "";
  return value.toString().replace(".", ",");
}

function fmtBool(value: boolean | null | undefined): string {
  if (value === true) return "Sim";
  if (value === false) return "Não";
  return "";
}

function lookup<T extends string>(value: T | null, map: Record<T, string>): string {
  if (!value) return "";
  return map[value] ?? value;
}

const COLUMNS: Array<{ header: string; get: (o: Order) => string }> = [
  { header: "ID",                       get: (o) => o.order_id },
  { header: "Criada em",                get: (o) => fmtDateTime(o.created_at) },
  { header: "Estado",                   get: (o) => lookup(o.status, STATUS_LABELS) },
  { header: "Contactada",               get: (o) => fmtBool(o.contacted) },
  { header: "Cliente",                  get: (o) => o.client_name },
  { header: "Email",                    get: (o) => o.email ?? "" },
  { header: "Telemóvel",                get: (o) => o.phone ?? "" },
  { header: "Contacto preferido",       get: (o) => lookup(o.contact_preference, CONTACT_PREFERENCE_LABELS) },
  { header: "Idioma do form",           get: (o) => o.form_language === "en" ? "EN" : "PT" },
  { header: "Tipo de evento",           get: (o) => lookup(o.event_type, EVENT_TYPE_LABELS) },
  { header: "Nome dos noivos",          get: (o) => o.couple_names ?? "" },
  { header: "Data do evento",           get: (o) => fmtDate(o.event_date) },
  { header: "Localização",              get: (o) => o.event_location ?? "" },
  { header: "Tipo de flores",           get: (o) => o.flower_type ?? "" },
  { header: "Tamanho moldura",          get: (o) => lookup(o.frame_size, FRAME_SIZE_LABELS) },
  { header: "Fundo do quadro",          get: (o) => lookup(o.frame_background, FRAME_BACKGROUND_LABELS) },
  { header: "Extras (opções)",          get: (o) => (o.extras_in_frame?.options ?? []).join(" | ") },
  { header: "Extras (notas)",           get: (o) => o.extras_in_frame?.notes ?? "" },
  { header: "Quadros pequenos",         get: (o) => lookup(o.extra_small_frames, YES_NO_INFO_LABELS) },
  { header: "Quadros pequenos qty",     get: (o) => o.extra_small_frames_qty?.toString() ?? "" },
  { header: "Ornamentos Natal",         get: (o) => lookup(o.christmas_ornaments, YES_NO_INFO_LABELS) },
  { header: "Ornamentos Natal qty",     get: (o) => o.christmas_ornaments_qty?.toString() ?? "" },
  { header: "Pendentes colares",        get: (o) => lookup(o.necklace_pendants, YES_NO_INFO_LABELS) },
  { header: "Pendentes colares qty",    get: (o) => o.necklace_pendants_qty?.toString() ?? "" },
  { header: "Envio das flores",         get: (o) => lookup(o.flower_delivery_method, FLOWER_DELIVERY_METHOD_LABELS) },
  { header: "Custo envio flores (€)",   get: (o) => fmtEuro(o.flower_shipping_cost) },
  { header: "Envio flores pago",        get: (o) => fmtBool(o.flower_shipping_paid) },
  { header: "Receção do quadro",        get: (o) => lookup(o.frame_delivery_method, FRAME_DELIVERY_METHOD_LABELS) },
  { header: "Custo envio quadro (€)",   get: (o) => fmtEuro(o.frame_shipping_cost) },
  { header: "Envio quadro pago",        get: (o) => fmtBool(o.frame_shipping_paid) },
  { header: "Como conheceu FBR",        get: (o) => lookup(o.how_found_fbr, HOW_FOUND_FBR_LABELS) },
  { header: "Código vale-presente",     get: (o) => o.gift_voucher_code ?? "" },
  { header: "Orçamento (€)",            get: (o) => fmtEuro(o.budget) },
  { header: "Pagamento",                get: (o) => lookup(o.payment_status, PAYMENT_STATUS_LABELS) },
  { header: "Cliente pediu fatura",     get: (o) => fmtBool(o.needs_invoice) },
  { header: "NIF",                      get: (o) => o.nif ?? "" },
  { header: "Anexo fatura",             get: (o) => o.invoice_attachment_url ?? "" },
  { header: "Comissão (€)",             get: (o) => fmtEuro(o.partner_commission) },
  { header: "Estado comissão",          get: (o) => lookup(o.partner_commission_status, PARTNER_COMMISSION_STATUS_LABELS) },
  { header: "Cupão 5%",                 get: (o) => o.coupon_code ?? "" },
  { header: "Validade cupão",           get: (o) => fmtDate(o.coupon_expiry) },
  { header: "Estado cupão",             get: (o) => lookup(o.coupon_status, COUPON_STATUS_LABELS) },
  { header: "Feedback cliente",         get: (o) => lookup(o.client_feedback_status, CLIENT_FEEDBACK_STATUS_LABELS) },
  { header: "Data entrega quadro",      get: (o) => fmtDate(o.frame_delivery_date) },
  { header: "Notas adicionais",         get: (o) => o.additional_notes ?? "" },
  { header: "Pasta Drive",              get: (o) => o.drive_folder_url ?? "" },
  { header: "Foto encomenda",           get: (o) => o.flowers_photo_url ?? "" },
];

function escapeCell(value: string): string {
  // CSV escape: aspas duplas + duplicar aspas dentro do campo.
  // Sempre entre aspas para tolerar `;`, quebras de linha, etc.
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const sep = ";";
  const csv = "﻿" + rows.map((r) => r.map(escapeCell).join(sep)).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = format(new Date(), "yyyy-MM-dd_HHmm");
  a.href = url;
  a.download = `${filename}_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportOrdersToCsv(orders: Order[]): void {
  const headerLine = COLUMNS.map((c) => c.header);
  const lines = orders.map((o) => COLUMNS.map((c) => c.get(o) ?? ""));
  downloadCsv("fbr-encomendas", [headerLine, ...lines]);
}

// ── Vales ───────────────────────────────────────────────────────

const VOUCHER_COLUMNS: Array<{ header: string; get: (v: Voucher) => string }> = [
  { header: "Código",                  get: (v) => v.code },
  { header: "Criado em",               get: (v) => fmtDateTime(v.created_at) },
  { header: "Remetente",               get: (v) => v.sender_name },
  { header: "Email remetente",         get: (v) => v.sender_email ?? "" },
  { header: "Telemóvel remetente",     get: (v) => v.sender_phone ?? "" },
  { header: "Destinatário",            get: (v) => v.recipient_name },
  { header: "Mensagem",                get: (v) => v.message ?? "" },
  { header: "Valor (€)",               get: (v) => fmtEuro(v.amount) },
  { header: "Entrega para",            get: (v) => lookup(v.delivery_recipient, VOUCHER_DELIVERY_RECIPIENT_LABELS) },
  { header: "Formato",                 get: (v) => lookup(v.delivery_format, VOUCHER_DELIVERY_FORMAT_LABELS) },
  { header: "Canal digital",           get: (v) => lookup(v.delivery_channel, VOUCHER_DELIVERY_CHANNEL_LABELS) },
  { header: "Custo envio (€)",         get: (v) => fmtEuro(v.delivery_shipping_cost) },
  { header: "Contacto destinatário",   get: (v) => v.recipient_contact ?? "" },
  { header: "Morada destinatário",     get: (v) => v.recipient_address ?? "" },
  { header: "Data ideal envio",        get: (v) => fmtDate(v.ideal_send_date) },
  { header: "Comentários",             get: (v) => v.comments ?? "" },
  { header: "Pagamento",               get: (v) => lookup(v.payment_status, VOUCHER_PAYMENT_STATUS_LABELS) },
  { header: "Envio do vale",           get: (v) => lookup(v.send_status, VOUCHER_SEND_STATUS_LABELS) },
  { header: "Data envio agendada",     get: (v) => fmtDate(v.scheduled_send_date) },
  { header: "Utilização",              get: (v) => lookup(v.usage_status, VOUCHER_USAGE_STATUS_LABELS) },
  { header: "Validade",                get: (v) => fmtDate(v.expiry_date) },
  { header: "Cliente pediu fatura",    get: (v) => fmtBool(v.needs_invoice) },
  { header: "NIF",                     get: (v) => v.nif ?? "" },
  { header: "Anexo fatura",            get: (v) => v.invoice_attachment_url ?? "" },
  { header: "Como conheceu FBR",       get: (v) => lookup(v.how_found_fbr, HOW_FOUND_FBR_LABELS) },
  { header: "Origem (outro)",          get: (v) => v.how_found_fbr_other ?? "" },
  { header: "Idioma do form",          get: (v) => (v.form_language === "en" ? "EN" : "PT") },
  { header: "Parceiro (id)",           get: (v) => v.partner_id ?? "" },
  { header: "Comissão (€)",            get: (v) => fmtEuro(v.partner_commission) },
  { header: "Estado comissão",         get: (v) => lookup(v.partner_commission_status, PARTNER_COMMISSION_STATUS_LABELS) },
  { header: "Sticky note",             get: (v) => v.sticky_note ?? "" },
  { header: "Pasta Drive",             get: (v) => v.drive_folder_url ?? "" },
];

export function exportVouchersToCsv(vouchers: Voucher[]): void {
  const headerLine = VOUCHER_COLUMNS.map((c) => c.header);
  const lines = vouchers.map((v) => VOUCHER_COLUMNS.map((c) => c.get(v) ?? ""));
  downloadCsv("fbr-vales", [headerLine, ...lines]);
}

// ── Parceiros ───────────────────────────────────────────────────

const PARTNER_COLUMNS: Array<{ header: string; get: (p: Partner) => string }> = [
  { header: "Nome",                    get: (p) => p.name },
  { header: "Categoria",               get: (p) => lookup(p.category, PARTNER_CATEGORY_LABELS) },
  { header: "Estado",                  get: (p) => lookup(p.status, PARTNER_STATUS_LABELS) },
  { header: "Responsável",             get: (p) => p.contact_person ?? "" },
  { header: "Email",                   get: (p) => p.email ?? "" },
  { header: "Telemóveis",              get: (p) => (p.phones ?? []).map((ph) => (ph.label ? `${ph.label}: ${ph.number}` : ph.number)).join(" | ") },
  { header: "Links",                   get: (p) => (p.links ?? []).join(" | ") },
  { header: "Localização",             get: (p) => p.location_label ?? "" },
  { header: "Latitude",                get: (p) => p.latitude?.toString() ?? "" },
  { header: "Longitude",               get: (p) => p.longitude?.toString() ?? "" },
  { header: "Aceita comissão",         get: (p) => lookup(p.accepts_commission, PARTNER_ACCEPTS_COMMISSION_LABELS) },
  { header: "Notas",                   get: (p) => p.notes ?? "" },
  { header: "Nº de interações",        get: (p) => (p.interactions?.length ?? 0).toString() },
  { header: "Acções pendentes",        get: (p) => (p.actions?.filter((a) => !a.done).length ?? 0).toString() },
  { header: "Criado em",               get: (p) => fmtDateTime(p.created_at) },
  { header: "Última edição",           get: (p) => fmtDateTime(p.updated_at) },
];

export function exportPartnersToCsv(partners: Partner[], filenameSuffix?: string): void {
  const headerLine = PARTNER_COLUMNS.map((c) => c.header);
  const lines = partners.map((p) => PARTNER_COLUMNS.map((c) => c.get(p) ?? ""));
  const filename = filenameSuffix ? `fbr-parceiros-${filenameSuffix}` : "fbr-parceiros";
  downloadCsv(filename, [headerLine, ...lines]);
}
