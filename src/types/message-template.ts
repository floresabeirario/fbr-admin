// ============================================================
// Tipos para a biblioteca de templates de mensagens
// ============================================================
// Migração 041_message_templates.sql cria as tabelas
// `message_templates` e `system_settings`. Estes tipos espelham
// os campos e são usados pela UI de gestão (Sistema → Templates)
// e pelo picker no workbench.
// ============================================================

import type { OrderStatus } from "./database";

export type TemplateLanguage = "pt" | "en";

export type TemplateScope = "order" | "voucher" | "both";

export type TemplateCategory =
  | "pre_reserva"
  | "reserva"
  | "recepcao_flores"
  | "preservacao"
  | "aprovacao_design"
  | "finalizacao"
  | "entrega"
  | "pos_venda"
  | "factura"
  | "vale_presente"
  | "lembretes"
  | "outros";

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  pre_reserva: "Pré-reserva",
  reserva: "Reserva confirmada",
  recepcao_flores: "Recepção das flores",
  preservacao: "Preservação",
  aprovacao_design: "Aprovação de design",
  finalizacao: "Finalização",
  entrega: "Entrega",
  pos_venda: "Pós-venda",
  factura: "Factura",
  vale_presente: "Vale-presente",
  lembretes: "Lembretes",
  outros: "Outros",
};

export const TEMPLATE_CATEGORY_ORDER: TemplateCategory[] = [
  "pre_reserva",
  "lembretes",
  "reserva",
  "recepcao_flores",
  "preservacao",
  "aprovacao_design",
  "finalizacao",
  "entrega",
  "pos_venda",
  "factura",
  "vale_presente",
  "outros",
];

export const TEMPLATE_LANGUAGE_LABELS: Record<TemplateLanguage, string> = {
  pt: "Português",
  en: "English",
};

export const TEMPLATE_SCOPE_LABELS: Record<TemplateScope, string> = {
  order: "Preservação",
  voucher: "Vale-presente",
  both: "Ambos",
};

export interface MessageTemplate {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  created_by: string | null;
  updated_by: string | null;

  slug: string;
  name: string;
  language: TemplateLanguage;
  category: TemplateCategory;
  body: string;
  suggested_statuses: OrderStatus[];
  scope: TemplateScope;
  position: number;
  is_seed: boolean;
}

export type MessageTemplateInsert = Partial<
  Omit<MessageTemplate, "id" | "created_at" | "updated_at">
> & {
  slug: string;
  name: string;
  language: TemplateLanguage;
  category: TemplateCategory;
  body: string;
};

export type MessageTemplateUpdate = Partial<
  Omit<MessageTemplate, "id" | "created_at">
>;

// ─── system_settings ────────────────────────────────────────

export type SystemSettingKey =
  | "payment_account_holder"
  | "payment_iban"
  | "payment_bic"
  | "payment_bank_name"
  | "payment_mbway"
  | "studio_address_url"
  | "studio_address_text"
  | "review_link"
  | "claude_persona"
  | "claude_facts";

export const SYSTEM_SETTING_LABELS: Record<SystemSettingKey, string> = {
  payment_account_holder: "Titular da conta",
  payment_iban: "IBAN",
  payment_bic: "BIC / SWIFT",
  payment_bank_name: "Nome do banco",
  payment_mbway: "MB Way",
  studio_address_url: "Morada do estúdio (link Maps)",
  studio_address_text: "Morada do estúdio (descrição)",
  review_link: "Link de opinião / avaliação",
  claude_persona: "Tom / Persona da Claude",
  claude_facts: "Factos & contexto adicional",
};

export const SYSTEM_SETTING_KEYS: SystemSettingKey[] = [
  "payment_mbway",
  "payment_iban",
  "payment_account_holder",
  "payment_bic",
  "payment_bank_name",
  "studio_address_url",
  "studio_address_text",
  "review_link",
  "claude_persona",
  "claude_facts",
];

export interface SystemSetting {
  key: SystemSettingKey;
  value: string;
  updated_at: string;
  updated_by: string | null;
}

export type SystemSettingsMap = Record<SystemSettingKey, string>;
