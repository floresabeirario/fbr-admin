// ============================================================
// FBR Admin — Tipos TypeScript para parcerias
// ============================================================

// ── Categoria (sub-aba) ──────────────────────────────────────
export type PartnerCategory =
  | "wedding_planners"
  | "floristas"
  | "quintas_eventos"
  | "outros";

// ── Estado (funil de relação) ────────────────────────────────
export type PartnerStatus =
  | "por_contactar"
  | "pendente"
  | "tentativa_contacto"
  | "aceite"
  | "confirmado"
  | "rejeitado";

// ── Aceita comissão de 10% ───────────────────────────────────
export type PartnerAcceptsCommission = "sim" | "nao" | "a_confirmar";

// ── Telemóvel com etiqueta opcional (pessoa ou departamento) ──
export interface PartnerPhone {
  label: string | null; // ex.: "Ana Paula", "Reservas", null = sem etiqueta
  number: string;
}

// ── Canal de uma interação ───────────────────────────────────
export type InteractionChannel =
  | "email"
  | "whatsapp"
  | "telefone"
  | "reuniao"
  | "outro";

// ── Histórico de interações ──────────────────────────────────
export interface PartnerInteraction {
  id: string;             // uuid local (gerado no cliente)
  date: string;           // ISO datetime
  channel: InteractionChannel;
  summary: string;        // texto livre
  by: string | null;      // email do utilizador que registou
}

// ── Acção pendente ───────────────────────────────────────────
export interface PartnerAction {
  id: string;             // uuid local
  title: string;
  assignee_email: string | null; // a quem está atribuída
  due_date: string | null;       // ISO date
  done: boolean;
  done_at: string | null;
  done_by: string | null;
  created_at: string;
  created_by: string | null;
}

// ── Tipo completo (corresponde à tabela partners) ────────────
export interface Partner {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;

  name: string;
  category: PartnerCategory;
  status: PartnerStatus;

  contact_person: string | null;
  email: string | null;
  phones: PartnerPhone[];
  links: string[];

  location_label: string | null;
  latitude: number | null;
  longitude: number | null;

  accepts_commission: PartnerAcceptsCommission | null;

  notes: string | null;
  interactions: PartnerInteraction[];
  actions: PartnerAction[];
}

// ── Insert / Update ──────────────────────────────────────────
export type PartnerInsert = Partial<Omit<Partner, "id" | "created_at" | "updated_at">> & {
  name: string;
  category: PartnerCategory;
};

export type PartnerUpdate = Partial<Omit<Partner, "id" | "created_at">>;

// ============================================================
// LABELS LEGÍVEIS
// ============================================================

export const PARTNER_CATEGORY_LABELS: Record<PartnerCategory, string> = {
  wedding_planners: "Wedding Planners",
  floristas: "Floristas",
  quintas_eventos: "Quintas de Eventos",
  outros: "Outros",
};

// Singular (para o título do card / botão "Novo X")
export const PARTNER_CATEGORY_SINGULAR: Record<PartnerCategory, string> = {
  wedding_planners: "Wedding Planner",
  floristas: "Florista",
  quintas_eventos: "Quinta de Eventos",
  outros: "Parceiro",
};

export const PARTNER_STATUS_LABELS: Record<PartnerStatus, string> = {
  por_contactar: "Por contactar",
  pendente: "Pendente",
  tentativa_contacto: "Tentativa de contacto",
  aceite: "Aceite",
  confirmado: "Confirmado",
  rejeitado: "Rejeitado",
};

// Cores associadas a cada estado (badge + select trigger)
export const PARTNER_STATUS_COLORS: Record<PartnerStatus, string> = {
  por_contactar:      "bg-slate-100 text-slate-700 border-slate-300",
  pendente:           "bg-amber-100 text-amber-800 border-amber-300",
  tentativa_contacto: "bg-orange-100 text-orange-800 border-orange-300",
  aceite:             "bg-sky-100 text-sky-800 border-sky-300",
  confirmado:         "bg-emerald-100 text-emerald-800 border-emerald-300",
  rejeitado:          "bg-rose-100 text-rose-700 border-rose-200",
};

// Pontos coloridos (para o mapa)
export const PARTNER_STATUS_DOT: Record<PartnerStatus, string> = {
  por_contactar:      "bg-slate-400",
  pendente:           "bg-amber-500",
  tentativa_contacto: "bg-orange-500",
  aceite:             "bg-sky-500",
  confirmado:         "bg-emerald-500",
  rejeitado:          "bg-rose-400",
};

export const PARTNER_ACCEPTS_COMMISSION_LABELS: Record<PartnerAcceptsCommission, string> = {
  sim: "Sim, aceita",
  nao: "Não aceita",
  a_confirmar: "Por confirmar",
};

export const PARTNER_ACCEPTS_COMMISSION_COLORS: Record<PartnerAcceptsCommission, string> = {
  sim:         "bg-emerald-100 text-emerald-800 border-emerald-300",
  nao:         "bg-rose-100 text-rose-800 border-rose-300",
  a_confirmar: "bg-amber-100 text-amber-800 border-amber-300",
};

export const INTERACTION_CHANNEL_LABELS: Record<InteractionChannel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  reuniao: "Reunião",
  outro: "Outro",
};

export const INTERACTION_CHANNEL_COLORS: Record<InteractionChannel, string> = {
  email:    "bg-sky-100 text-sky-800 border-sky-300",
  whatsapp: "bg-emerald-100 text-emerald-800 border-emerald-300",
  telefone: "bg-violet-100 text-violet-800 border-violet-300",
  reuniao:  "bg-amber-100 text-amber-800 border-amber-300",
  outro:    "bg-slate-100 text-slate-700 border-slate-300",
};

// ── Categorias com ícone (decorativo) ────────────────────────
export const PARTNER_CATEGORY_COLORS: Record<PartnerCategory, string> = {
  wedding_planners: "from-rose-100 to-pink-100 text-rose-700",
  floristas:        "from-emerald-100 to-green-100 text-emerald-700",
  quintas_eventos:  "from-amber-100 to-yellow-100 text-amber-700",
  outros:           "from-slate-100 to-gray-100 text-slate-700",
};

// ── Ordem dos estados (para grupos colapsáveis na tabela) ────
export const PARTNER_STATUS_ORDER: PartnerStatus[] = [
  "por_contactar",
  "pendente",
  "tentativa_contacto",
  "aceite",
  "confirmado",
  "rejeitado",
];

// ── Ordem das categorias (sub-abas) ──────────────────────────
export const PARTNER_CATEGORY_ORDER: PartnerCategory[] = [
  "wedding_planners",
  "floristas",
  "quintas_eventos",
  "outros",
];
