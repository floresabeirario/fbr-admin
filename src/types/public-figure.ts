// ============================================================
// FBR Admin — Tipos TypeScript para Figuras Públicas
// (influencers / celebridades / figuras públicas — campanha de seeding)
//
// Vive na mesma aba que as Parcerias mas é um modelo próprio.
// Reaproveita as formas de interações, acções e telefones das Parcerias.
// ============================================================

import type {
  PartnerPhone,
  PartnerInteraction,
  PartnerAction,
} from "@/types/partner";

// Reexporta com nomes próprios do módulo (mesma forma estrutural).
export type FigurePhone = PartnerPhone;
export type FigureInteraction = PartnerInteraction;
export type FigureAction = PartnerAction;

// ── Tipo de figura ───────────────────────────────────────────
export type FigureType = "influencer" | "celebridade" | "figura_publica";

// ── Estado (funil da oferta) ─────────────────────────────────
export type FigureStatus =
  | "por_contactar"
  | "contactada"
  | "em_conversa"
  | "aceitou"
  | "em_producao"
  | "concluida"
  | "recusou"
  | "sem_resposta";

// ── Prioridade ───────────────────────────────────────────────
export type FigurePriority = "alta" | "media" | "baixa";

// ── Tipo de evento ───────────────────────────────────────────
export type FigureEventType = "casamento" | "batizado" | "outro";

// ── O que oferecemos ─────────────────────────────────────────
export type FigureOfferType = "preservacao_gratis" | "desconto" | "contrapartida";

// ── Canal de contacto preferido ──────────────────────────────
export type FigureContactChannel =
  | "instagram_dm"
  | "email"
  | "agencia"
  | "whatsapp"
  | "outro";

// ── Entregável da contrapartida (checklist) ──────────────────
export interface FigureDeliverable {
  id: string; // uuid local
  title: string; // ex.: "Story com link", "Reel"
  due_date: string | null; // data prevista de publicação (ISO date)
  done: boolean; // já publicado?
  published_url: string | null; // link da publicação
  done_at: string | null;
  done_by: string | null;
}

// ── Tipo completo (corresponde à tabela public_figures) ──────
export interface PublicFigure {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;

  name: string;
  figure_type: FigureType;
  status: FigureStatus;
  priority: FigurePriority;

  instagram_handle: string | null;
  tiktok_handle: string | null;
  followers: number | null;

  tags: string[];
  fit_note: string | null;

  event_type: FigureEventType;
  event_date: string | null;

  offer_type: FigureOfferType | null;
  frame_size: string | null;
  estimated_cost: number | null;

  deliverables: FigureDeliverable[];
  story_screenshots: string[];

  brief_sent: boolean;
  brief_mention: string | null;
  brief_hashtag: string | null;

  contact_channel: FigureContactChannel | null;
  email: string | null;
  phones: FigurePhone[];
  agency_name: string | null;
  agency_contact: string | null;

  order_id: string | null;
  is_courtesy: boolean;

  notes: string | null;
  interactions: FigureInteraction[];
  actions: FigureAction[];
}

// ── Insert / Update ──────────────────────────────────────────
export type PublicFigureInsert = Partial<
  Omit<PublicFigure, "id" | "created_at" | "updated_at">
> & {
  name: string;
};

export type PublicFigureUpdate = Partial<Omit<PublicFigure, "id" | "created_at">>;

// ============================================================
// LABELS LEGÍVEIS
// ============================================================

export const FIGURE_TYPE_LABELS: Record<FigureType, string> = {
  influencer: "Influencer",
  celebridade: "Celebridade",
  figura_publica: "Figura pública",
};

export const FIGURE_STATUS_LABELS: Record<FigureStatus, string> = {
  por_contactar: "Por contactar",
  contactada: "Contactada",
  em_conversa: "Em conversa",
  aceitou: "Aceitou",
  em_producao: "Quadro em produção",
  concluida: "Concluída",
  recusou: "Recusou",
  sem_resposta: "Sem resposta",
};

// Cores associadas a cada estado (badge + select trigger)
export const FIGURE_STATUS_COLORS: Record<FigureStatus, string> = {
  por_contactar: "bg-slate-100 text-slate-700 border-slate-300",
  contactada:    "bg-sky-100 text-sky-800 border-sky-300",
  em_conversa:   "bg-violet-100 text-violet-800 border-violet-300",
  aceitou:       "bg-emerald-100 text-emerald-800 border-emerald-300",
  em_producao:   "bg-amber-100 text-amber-800 border-amber-300",
  concluida:     "bg-teal-100 text-teal-800 border-teal-300",
  recusou:       "bg-rose-100 text-rose-700 border-rose-200",
  sem_resposta:  "bg-orange-100 text-orange-800 border-orange-300",
};

export const FIGURE_PRIORITY_LABELS: Record<FigurePriority, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const FIGURE_PRIORITY_COLORS: Record<FigurePriority, string> = {
  alta:  "bg-rose-100 text-rose-800 border-rose-300",
  media: "bg-sky-100 text-sky-800 border-sky-300",
  baixa: "bg-slate-100 text-slate-700 border-slate-300",
};

export const FIGURE_EVENT_TYPE_LABELS: Record<FigureEventType, string> = {
  casamento: "Casamento",
  batizado: "Batizado",
  outro: "Outro",
};

export const FIGURE_OFFER_TYPE_LABELS: Record<FigureOfferType, string> = {
  preservacao_gratis: "Preservação grátis",
  desconto: "Desconto",
  contrapartida: "Contrapartida",
};

export const FIGURE_CONTACT_CHANNEL_LABELS: Record<FigureContactChannel, string> = {
  instagram_dm: "DM Instagram",
  email: "Email",
  agencia: "Agência",
  whatsapp: "WhatsApp",
  outro: "Outro",
};

// ── Ordem dos estados (grupos colapsáveis na tabela) ─────────
export const FIGURE_STATUS_ORDER: FigureStatus[] = [
  "por_contactar",
  "contactada",
  "em_conversa",
  "aceitou",
  "em_producao",
  "concluida",
  "sem_resposta",
  "recusou",
];

// Estados terminais (começam colapsados na listagem)
export const FIGURE_TERMINAL_STATUSES: FigureStatus[] = ["concluida", "recusou"];

// Estados que contam como "activos" para o resumo
export const FIGURE_ACTIVE_STATUSES: FigureStatus[] = [
  "contactada",
  "em_conversa",
  "aceitou",
  "em_producao",
];
