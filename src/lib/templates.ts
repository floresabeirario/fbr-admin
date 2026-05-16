// ============================================================
// Motor de templates de mensagens
// ============================================================
// Resolve as variáveis ({nome}, {valor_sinal}, {dados_pagamento}, ...)
// num template, com base nos dados da encomenda/vale + system_settings.
//
// Não toca em IA — é puro string-replace. O AI virá depois (Fase C).
// ============================================================

import { format, parseISO } from "date-fns";
import { pt, enUS } from "date-fns/locale";
import type { Order } from "@/types/database";

// Formato europeu compacto usado nas mensagens: "300€" para inteiros,
// "100,50€" quando há cêntimos. Difere de formatEUR (que dá "300,00€").
function fmtEurMsg(value: number): string {
  const fixed = value.toFixed(2);
  const [intPart, decPart] = fixed.split(".");
  if (decPart === "00") return `${intPart}€`;
  return `${intPart},${decPart}€`;
}
import type {
  MessageTemplate,
  SystemSettingsMap,
  TemplateLanguage,
} from "@/types/message-template";

// ─── Subset de Voucher que o motor precisa (sem importar tipo de tabela) ─

export interface VoucherForTemplate {
  code: string | null;
  sender_name: string | null;
  recipient_name: string | null;
  amount: number | null;
  // URL da página pública do vale (já calculado pelo caller)
  public_url?: string | null;
}

// ─── Saudação automática conforme hora ─────────────────────

export function saudacaoPorHora(language: TemplateLanguage, now: Date = new Date()): string {
  const h = now.getHours();
  if (language === "en") {
    if (h < 12) return "Good morning";
    if (h < 19) return "Good afternoon";
    return "Good evening";
  }
  if (h < 12) return "Bom dia";
  if (h < 19) return "Boa tarde";
  return "Boa noite";
}

// ─── Bloco de dados de pagamento (PT vs EN) ────────────────

export function dadosPagamento(language: TemplateLanguage, settings: SystemSettingsMap): string {
  if (language === "en") {
    // Internacional: omite MB Way (não funciona fora de PT)
    return [
      `Account Holder: ${settings.payment_account_holder}`,
      `IBAN: ${settings.payment_iban}`,
      `BIC: ${settings.payment_bic}`,
      `Bank Name: ${settings.payment_bank_name}`,
    ].join("\n");
  }
  return [
    `MB Way: ${settings.payment_mbway}`,
    `IBAN: ${settings.payment_iban}`,
  ].join("\n");
}

// ─── Helpers ────────────────────────────────────────────────

function primeiroNome(nome: string | null | undefined): string {
  if (!nome) return "";
  const trimmed = nome.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0];
}

function dataExtenso(iso: string | null, language: TemplateLanguage): string {
  if (!iso) return "";
  try {
    const d = parseISO(iso);
    if (language === "en") {
      // "May 15th, 2026"
      return format(d, "MMMM do, yyyy", { locale: enUS });
    }
    // "15 de Maio de 2026"
    return format(d, "d 'de' MMMM 'de' yyyy", { locale: pt });
  } catch {
    return iso;
  }
}

function dataCurta(iso: string | null): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

function statusUrl(orderId: string): string {
  // Mantém o link do status público (status.floresabeirario.pt)
  return `https://status.floresabeirario.pt/${orderId}`;
}

function voucherUrl(code: string): string {
  return `https://voucher.floresabeirario.pt/${code}`;
}

// Substitui todas as ocorrências de {chave} pelo valor (escape regex-safe).
function substituir(corpo: string, vars: Record<string, string>): string {
  let out = corpo;
  for (const [k, v] of Object.entries(vars)) {
    const pattern = new RegExp(`\\{${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}`, "g");
    out = out.replace(pattern, v);
  }
  return out;
}

// ─── Render de template para encomenda (Preservação) ───────

export interface RenderOrderContext {
  order: Order;
  settings: SystemSettingsMap;
  now?: Date;
}

export function renderOrderTemplate(template: MessageTemplate, ctx: RenderOrderContext): string {
  const { order, settings, now = new Date() } = ctx;
  const lang = template.language;

  // Total / parcelas a partir do pricing_snapshot (fallback ao budget manual)
  let total: number | null = order.pricing_snapshot?.total ?? null;
  if (total === null && order.budget !== null) {
    total = order.budget;
  }

  const sinal30 = total !== null ? Math.round(total * 0.3 * 100) / 100 : null;
  const parcela40 = total !== null ? Math.round(total * 0.4 * 100) / 100 : null;
  const parcela30 = total !== null ? Math.round(total * 0.3 * 100) / 100 : null;

  // Valor do quadro base (sem extras) — útil para mensagens de pré-reserva
  // onde só queremos mostrar o preço da moldura escolhida.
  let valorQuadro: number | null = null;
  if (order.pricing_snapshot) {
    const baseLine = order.pricing_snapshot.lines.find(
      (l) => l.category === "base_frame",
    );
    if (baseLine) valorQuadro = baseLine.subtotal;
  }

  const saudacao = saudacaoPorHora(lang, now);
  // Mantém "30x40 cm" (com "x" minúsculo) — é a forma usada nas conversas reais da Maria.
  const tamanho = order.frame_size && order.frame_size !== "voces_a_escolher" && order.frame_size !== "nao_sei"
    ? `${order.frame_size} cm`
    : "";

  const vars: Record<string, string> = {
    saudacao,
    saudacao_en: saudacaoPorHora("en", now),
    nome: primeiroNome(order.client_name),
    nome_completo: order.client_name ?? "",
    tamanho_quadro: tamanho,
    valor_quadro: valorQuadro !== null ? fmtEurMsg(valorQuadro) : "",
    valor_total: total !== null ? fmtEurMsg(total) : "",
    valor_sinal: sinal30 !== null ? fmtEurMsg(sinal30) : "",
    valor_2a_parcela: parcela40 !== null ? fmtEurMsg(parcela40) : "",
    valor_3a_parcela: parcela30 !== null ? fmtEurMsg(parcela30) : "",
    data_evento: dataCurta(order.event_date),
    data_evento_extenso: dataExtenso(order.event_date, "pt"),
    data_evento_extenso_en: dataExtenso(order.event_date, "en"),
    link_status: statusUrl(order.order_id),
    dados_pagamento: dadosPagamento(lang, settings),
    morada_estudio: settings.studio_address_url || "",
    morada_estudio_texto: settings.studio_address_text || "",
  };

  return substituir(template.body, vars);
}

// ─── Render de template para vale-presente ─────────────────

export interface RenderVoucherContext {
  voucher: VoucherForTemplate;
  settings: SystemSettingsMap;
  now?: Date;
}

export function renderVoucherTemplate(template: MessageTemplate, ctx: RenderVoucherContext): string {
  const { voucher, settings, now = new Date() } = ctx;
  const lang = template.language;
  const saudacao = saudacaoPorHora(lang, now);

  const vars: Record<string, string> = {
    saudacao,
    saudacao_en: saudacaoPorHora("en", now),
    nome_remetente: primeiroNome(voucher.sender_name),
    nome_destinatario: primeiroNome(voucher.recipient_name),
    nome_remetente_completo: voucher.sender_name ?? "",
    nome_destinatario_completo: voucher.recipient_name ?? "",
    codigo_vale: voucher.code ?? "",
    link_vale: voucher.public_url ?? (voucher.code ? voucherUrl(voucher.code) : ""),
    valor_vale: voucher.amount !== null ? fmtEurMsg(voucher.amount) : "",
    dados_pagamento: dadosPagamento(lang, settings),
    morada_estudio: settings.studio_address_url || "",
  };

  return substituir(template.body, vars);
}

// ─── Lista de variáveis disponíveis (para a UI de edição) ──

export interface TemplateVariable {
  key: string;
  description: string;
  scope: "order" | "voucher" | "both";
}

export const AVAILABLE_VARIABLES: TemplateVariable[] = [
  // Comuns
  { key: "saudacao", description: "Bom dia / Boa tarde / Boa noite (PT) ou Good morning / Good afternoon / Good evening (EN)", scope: "both" },
  { key: "dados_pagamento", description: "Bloco completo de dados de pagamento (PT: MB Way+IBAN | EN: Titular+IBAN+BIC+Banco)", scope: "both" },
  { key: "morada_estudio", description: "Link Maps do estúdio FBR", scope: "both" },

  // Encomenda
  { key: "nome", description: "Primeiro nome do cliente", scope: "order" },
  { key: "nome_completo", description: "Nome completo do cliente", scope: "order" },
  { key: "tamanho_quadro", description: 'Tamanho do quadro escolhido (ex: "30x40 cm")', scope: "order" },
  { key: "valor_quadro", description: "Preço da moldura escolhida (ex: 300€)", scope: "order" },
  { key: "valor_total", description: "Valor total da encomenda", scope: "order" },
  { key: "valor_sinal", description: "30% do total (sinal)", scope: "order" },
  { key: "valor_2a_parcela", description: "40% do total (após recepção das flores)", scope: "order" },
  { key: "valor_3a_parcela", description: "30% do total (antes da entrega)", scope: "order" },
  { key: "data_evento", description: "Data do evento (dd/MM/yyyy)", scope: "order" },
  { key: "data_evento_extenso", description: 'Data por extenso PT (ex: "15 de Maio de 2026")', scope: "order" },
  { key: "data_evento_extenso_en", description: 'Date in English (ex: "May 15th, 2026")', scope: "order" },
  { key: "link_status", description: "Link público de acompanhamento da encomenda", scope: "order" },

  // Vale
  { key: "nome_remetente", description: "Primeiro nome do remetente do vale", scope: "voucher" },
  { key: "nome_destinatario", description: "Primeiro nome do destinatário do vale", scope: "voucher" },
  { key: "codigo_vale", description: "Código do vale (6 caracteres)", scope: "voucher" },
  { key: "link_vale", description: "Link público do vale (voucher.floresabeirario.pt/xxx)", scope: "voucher" },
  { key: "valor_vale", description: "Valor do vale", scope: "voucher" },
];

// ─── Ordenação por estado sugerido ─────────────────────────

/**
 * Devolve uma lista de templates ordenada com:
 *   1. Templates sugeridos para `currentStatus` (na ordem da posição)
 *   2. Restantes templates por categoria
 *
 * Filtra automaticamente pelo `scope` (order/voucher) e opcionalmente pelo
 * idioma preferido (ex: idioma do formulário do cliente).
 */
export function rankTemplatesForStatus(
  templates: MessageTemplate[],
  options: {
    scope: "order" | "voucher";
    currentStatus?: string | null;
    preferredLanguage?: TemplateLanguage;
  },
): { suggested: MessageTemplate[]; others: MessageTemplate[] } {
  const filtered = templates.filter(
    (t) =>
      t.deleted_at === null &&
      (t.scope === options.scope || t.scope === "both"),
  );

  const suggested: MessageTemplate[] = [];
  const others: MessageTemplate[] = [];

  for (const t of filtered) {
    const matchesStatus =
      options.currentStatus &&
      t.suggested_statuses.includes(options.currentStatus as never);
    if (matchesStatus) {
      suggested.push(t);
    } else {
      others.push(t);
    }
  }

  // Se há idioma preferido, dentro de cada bucket coloca os do idioma à frente
  const byPreferred = (a: MessageTemplate, b: MessageTemplate) => {
    if (options.preferredLanguage) {
      const aPref = a.language === options.preferredLanguage ? 0 : 1;
      const bPref = b.language === options.preferredLanguage ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
    }
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.position - b.position;
  };

  suggested.sort(byPreferred);
  others.sort(byPreferred);

  return { suggested, others };
}
