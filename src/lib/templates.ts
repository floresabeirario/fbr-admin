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

  // Acerto de pagamento: euros já pagos + o que falta para o próximo marco.
  // Usa o orçamento no momento do 1º pagamento (budget_at_first_payment)
  // como base do que foi realmente pago — relevante quando o tamanho da
  // moldura foi decidido depois do sinal e o orçamento subiu. Sem âncora
  // (encomenda normal), assume que o pago corresponde ao orçamento actual.
  const paidFrac: Record<Order["payment_status"], number> = {
    "100_por_pagar": 0,
    "30_pago": 0.3,
    "70_pago": 0.7,
    "100_pago": 1,
  };
  const frac = paidFrac[order.payment_status] ?? 0;
  const baseParaPago = order.budget_at_first_payment ?? total;
  const sinalPago =
    frac > 0 && baseParaPago !== null
      ? Math.round(frac * baseParaPago * 100) / 100
      : null;
  const proxFrac = frac < 0.3 ? 0.3 : frac < 0.7 ? 0.7 : 1;
  const valorEmFalta =
    total !== null && sinalPago !== null
      ? Math.round((proxFrac * total - sinalPago) * 100) / 100
      : null;

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
    sinal_pago: sinalPago !== null ? fmtEurMsg(sinalPago) : "",
    valor_em_falta: valorEmFalta !== null ? fmtEurMsg(valorEmFalta) : "",
    data_evento: dataCurta(order.event_date),
    data_evento_extenso: dataExtenso(order.event_date, "pt"),
    data_evento_extenso_en: dataExtenso(order.event_date, "en"),
    link_status: statusUrl(order.order_id),
    link_avaliacao: settings.review_link || "",
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
  { key: "sinal_pago", description: "Valor já pago pelo cliente (em €) — útil quando o tamanho foi decidido depois do sinal", scope: "order" },
  { key: "valor_em_falta", description: "Valor a pedir nesta etapa (próximo marco menos o que já foi pago)", scope: "order" },
  { key: "data_evento", description: "Data do evento (dd/MM/yyyy)", scope: "order" },
  { key: "data_evento_extenso", description: 'Data por extenso PT (ex: "15 de Maio de 2026")', scope: "order" },
  { key: "data_evento_extenso_en", description: 'Date in English (ex: "May 15th, 2026")', scope: "order" },
  { key: "link_status", description: "Link público de acompanhamento da encomenda", scope: "order" },
  { key: "link_avaliacao", description: "Link para o cliente deixar opinião (Google / página de opiniões)", scope: "order" },

  // Vale
  { key: "nome_remetente", description: "Primeiro nome do remetente do vale", scope: "voucher" },
  { key: "nome_destinatario", description: "Primeiro nome do destinatário do vale", scope: "voucher" },
  { key: "codigo_vale", description: "Código do vale (6 caracteres)", scope: "voucher" },
  { key: "link_vale", description: "Link público do vale (voucher.floresabeirario.pt/xxx)", scope: "voucher" },
  { key: "valor_vale", description: "Valor do vale", scope: "voucher" },
];

// ─── Sugestões por campos da encomenda ─────────────────────
// Regras que olham para o que o cliente preencheu no formulário
// ("não sei" no envio das flores, tamanho indeciso, funeral, …) e
// devolvem os slugs-base das templates certas para a situação. O
// picker (e o Claude) usam isto para que a Maria não tenha de andar
// à procura quando a informação já está toda na encomenda.

export interface OrderFieldsForSuggestion {
  status: string;
  payment_status: string;
  event_type?: string | null;
  frame_size?: string | null;
  flower_delivery_method?: string | null;
  pickup_address?: string | null;
  budget_at_first_payment?: number | null;
  // Pagamento em dinheiro à entrega (mig 076)
  cash_on_delivery?: boolean;
  // Encomenda paga com vale-presente
  gift_voucher_code?: string | null;
}

const STATUSES_FASE_DESIGN = new Set([
  "flores_na_prensa",
  "reconstrucao_botanica",
  "a_compor_design",
  "a_aguardar_aprovacao",
]);

function tamanhoIndecisoDe(order: OrderFieldsForSuggestion): boolean {
  return (
    !order.frame_size ||
    order.frame_size === "nao_sei" ||
    order.frame_size === "voces_a_escolher"
  );
}

export function fieldSuggestionBases(order: OrderFieldsForSuggestion): string[] {
  const bases: string[] = [];
  const st = order.status;
  const preReserva = st === "entrega_flores_agendar";
  const agendada = st === "entrega_agendada";
  const metodo = order.flower_delivery_method ?? null;
  const tamanhoIndeciso = tamanhoIndecisoDe(order);

  // Funeral: condolências primeiro, nunca "parabéns"
  if (order.event_type === "funeral" && (preReserva || agendada)) {
    bases.push("funeral_condolencias");
  }

  // Pré-reserva sem sinal pago: a mensagem certa depende do tamanho —
  // excepto se a encomenda está coberta por um vale-presente (não se
  // pede sinal a quem recebeu o vale).
  if (preReserva && order.payment_status === "100_por_pagar") {
    if (order.gift_voucher_code) {
      bases.push("vale_reserva_coberta");
    } else {
      bases.push(
        tamanhoIndeciso
          ? "pre_reserva_tamanho_indeciso"
          : "pre_reserva_tamanho_escolhido",
      );
    }
  }

  // Envio das flores "não sei" (ou por preencher) → apresentar as 3 opções
  if ((preReserva || agendada) && (metodo === null || metodo === "nao_sei")) {
    bases.push("opcoes_entrega_flores");
  }

  // Recolha escolhida mas ainda sem morada → pedir morada p/ orçamento
  if ((preReserva || agendada) && metodo === "recolha_evento" && !order.pickup_address) {
    bases.push("recolha_orcamento");
  }

  // Reserva confirmada: confirmação certa consoante o método de envio.
  // Pagamento em dinheiro à entrega tem confirmação própria (explica que
  // pode pagar o sinal ou sinal+2ª parcela em mão).
  if (agendada) {
    if (order.cash_on_delivery) bases.push("confirmacao_reserva_dinheiro");
    if (metodo === "maos" && !order.cash_on_delivery) {
      bases.push("confirmacao_reserva_maos");
    }
    if (metodo === "ctt") bases.push("confirmacao_reserva_ctt", "ctt_enviar_hoje");
    if (metodo === "recolha_evento") bases.push("confirmacao_reserva_recolha");
    bases.push("preparacao_flores");
  }

  // Flores connosco → 2ª parcela
  if (st === "flores_enviadas" || st === "flores_recebidas") {
    bases.push("recepcao_flores_2a_parcela");
  }

  // Fase de design: se o sinal foi pago com tamanho indeciso e o
  // tamanho entretanto ficou decidido, é altura do reajuste (mig 074).
  if (STATUSES_FASE_DESIGN.has(st)) {
    if (order.budget_at_first_payment != null && !tamanhoIndeciso) {
      bases.push("reajuste_pagamento_tamanho");
    }
    if (tamanhoIndeciso) bases.push("orientacao_quadro");
  }

  // Quadro a caminho → mensagem com código de seguimento
  if (st === "quadro_enviado") bases.push("quadro_enviado_tracking");

  return bases;
}

// ─── Relevância das sugestões por estado face aos campos ───
// Uma template marcada para o estado actual (suggested_statuses) só é
// realmente sugerida se os campos da encomenda não a contradisserem:
// condolências numa encomenda de casamento, "tamanho indeciso" quando
// o tamanho já está escolhido, confirmação CTT quando o envio é em
// mãos, etc. Sem entrada neste mapa = relevante sempre.
// As condições espelham as regras de fieldSuggestionBases, por isso
// uma template excluída aqui nunca é a que essas regras escolheram.
const RELEVANCIA_POR_CAMPOS: Record<
  string,
  (order: OrderFieldsForSuggestion) => boolean
> = {
  // Nunca sugerir condolências fora de funerais
  funeral_condolencias: (o) => o.event_type === "funeral",

  // Pedidos de sinal: só sem pagamento e sem vale-presente, e apenas a
  // variante que corresponde ao tamanho (escolhido vs indeciso)
  pre_reserva_tamanho_escolhido: (o) =>
    o.payment_status === "100_por_pagar" &&
    !o.gift_voucher_code &&
    !tamanhoIndecisoDe(o),
  pre_reserva_tamanho_indeciso: (o) =>
    o.payment_status === "100_por_pagar" &&
    !o.gift_voucher_code &&
    tamanhoIndecisoDe(o),
  lembrete_reserva_nao_paga: (o) =>
    o.payment_status === "100_por_pagar" && !o.gift_voucher_code,
  vale_reserva_coberta: (o) => Boolean(o.gift_voucher_code),

  // Envio das flores: cada mensagem só faz sentido com o método certo
  opcoes_entrega_flores: (o) => {
    const m = o.flower_delivery_method ?? null;
    return m === null || m === "nao_sei";
  },
  recolha_orcamento: (o) =>
    o.flower_delivery_method === "recolha_evento" && !o.pickup_address,
  ctt_enviar_hoje: (o) => o.flower_delivery_method === "ctt",
  confirmacao_reserva_ctt: (o) => o.flower_delivery_method === "ctt",
  confirmacao_reserva_recolha: (o) =>
    o.flower_delivery_method === "recolha_evento",
  confirmacao_reserva_maos: (o) =>
    o.flower_delivery_method === "maos" && !o.cash_on_delivery,
  confirmacao_reserva_dinheiro: (o) => o.cash_on_delivery === true,

  // Orientação do quadro só enquanto o tamanho estiver por decidir
  orientacao_quadro: (o) => tamanhoIndecisoDe(o),
};

// Compara o slug de uma template com um slug-base (sem sufixo de língua)
function slugBase(slug: string): string {
  return slug.replace(/_(pt|en)$/, "");
}

// Quando sabemos o idioma do cliente, a gémea no outro idioma é
// redundante nos sugeridos — desce para `demoted` (= "Todos os
// templates"). Uma template sem gémea no idioma preferido mantém-se:
// melhor sugerir no idioma errado do que não sugerir.
function soIdiomaPreferido(
  suggested: MessageTemplate[],
  preferred: TemplateLanguage | undefined,
  demoted: MessageTemplate[],
): MessageTemplate[] {
  if (!preferred) return suggested;
  const basesNoIdioma = new Set(
    suggested
      .filter((t) => t.language === preferred)
      .map((t) => slugBase(t.slug)),
  );
  const kept: MessageTemplate[] = [];
  for (const t of suggested) {
    if (t.language !== preferred && basesNoIdioma.has(slugBase(t.slug))) {
      demoted.push(t);
    } else {
      kept.push(t);
    }
  }
  return kept;
}

// ─── Leads (contacto directo no WhatsApp, ainda sem encomenda) ──
// Muita gente escreve antes de preencher o formulário. Estas são as
// templates típicas dessas conversas, na ordem mais frequente.

export const LEAD_SUGGESTED_BASES = [
  "primeiro_contacto_info",
  "pos_evento_vai_a_tempo",
  "opcoes_entrega_flores",
  "vale_oferta_info",
  "como_funciona_processo",
  "mostrar_trabalhos",
  "nao_fazemos_3d",
  "resposta_orcamento_caro",
  "funeral_condolencias",
  "recolha_orcamento",
];

export interface RenderLeadContext {
  contactName?: string | null;
  settings: SystemSettingsMap;
  now?: Date;
}

/**
 * Render de template para um lead (sem encomenda/vale): só resolve as
 * variáveis genéricas (saudação, nome do contacto, dados de pagamento,
 * morada, link de avaliação). Variáveis de encomenda ficam visíveis
 * ({assim}) para a Maria reparar e preencher antes de copiar.
 */
export function renderLeadTemplate(template: MessageTemplate, ctx: RenderLeadContext): string {
  const { contactName, settings, now = new Date() } = ctx;
  const lang = template.language;
  const vars: Record<string, string> = {
    saudacao: saudacaoPorHora(lang, now),
    saudacao_en: saudacaoPorHora("en", now),
    nome: primeiroNome(contactName),
    nome_completo: contactName ?? "",
    dados_pagamento: dadosPagamento(lang, settings),
    morada_estudio: settings.studio_address_url || "",
    morada_estudio_texto: settings.studio_address_text || "",
    link_avaliacao: settings.review_link || "",
  };
  return substituir(template.body, vars);
}

/**
 * Ordenação de templates para uma conversa de lead: primeiro as
 * templates típicas de primeiro contacto (LEAD_SUGGESTED_BASES, na
 * ordem definida), depois as restantes por categoria. Templates
 * exclusivas de vale ("voucher") ficam de fora, excepto as marcadas
 * como "both".
 */
export function rankTemplatesForLead(
  templates: MessageTemplate[],
  preferredLanguage?: TemplateLanguage,
): { suggested: MessageTemplate[]; others: MessageTemplate[] } {
  const filtered = templates.filter(
    (t) => t.deleted_at === null && t.scope !== "voucher",
  );
  const rank = new Map(LEAD_SUGGESTED_BASES.map((b, i) => [b, i]));

  const suggested: MessageTemplate[] = [];
  const others: MessageTemplate[] = [];
  for (const t of filtered) {
    if (rank.has(slugBase(t.slug))) suggested.push(t);
    else others.push(t);
  }

  const byLang = (a: MessageTemplate, b: MessageTemplate) => {
    if (!preferredLanguage) return 0;
    const aPref = a.language === preferredLanguage ? 0 : 1;
    const bPref = b.language === preferredLanguage ? 0 : 1;
    return aPref - bPref;
  };
  suggested.sort((a, b) => {
    const ra = rank.get(slugBase(a.slug)) ?? 99;
    const rb = rank.get(slugBase(b.slug)) ?? 99;
    if (ra !== rb) return ra - rb;
    return byLang(a, b);
  });
  const finalSuggested = soIdiomaPreferido(suggested, preferredLanguage, others);
  others.sort((a, b) => {
    const l = byLang(a, b);
    if (l !== 0) return l;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.position - b.position;
  });

  return { suggested: finalSuggested, others };
}

// ─── Ordenação por estado sugerido ─────────────────────────

/**
 * Devolve uma lista de templates ordenada com:
 *   1. Templates sugeridos pelas regras de campos (fieldSuggestionBases)
 *   2. Templates sugeridos para `currentStatus` (na ordem da posição)
 *   3. Restantes templates por categoria
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
    orderFields?: OrderFieldsForSuggestion;
  },
): { suggested: MessageTemplate[]; others: MessageTemplate[] } {
  const filtered = templates.filter(
    (t) =>
      t.deleted_at === null &&
      (t.scope === options.scope || t.scope === "both"),
  );

  const fieldBases = options.orderFields
    ? fieldSuggestionBases(options.orderFields)
    : [];
  const fieldBaseRank = new Map(fieldBases.map((b, i) => [b, i]));

  const fieldSuggested: MessageTemplate[] = [];
  const suggested: MessageTemplate[] = [];
  const others: MessageTemplate[] = [];

  for (const t of filtered) {
    if (fieldBaseRank.has(slugBase(t.slug))) {
      fieldSuggested.push(t);
      continue;
    }
    const matchesStatus =
      options.currentStatus &&
      t.suggested_statuses.includes(options.currentStatus as never);
    // Marcada para este estado mas contradita pelos campos (funeral
    // num casamento, CTT quando o envio é em mãos, …) → não sugerir.
    const relevante =
      !options.orderFields ||
      (RELEVANCIA_POR_CAMPOS[slugBase(t.slug)]?.(options.orderFields) ?? true);
    if (matchesStatus && relevante) {
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

  // Os sugeridos por campos ordenam pela ordem das regras (a mais
  // específica primeiro), com o idioma preferido à frente dentro da
  // mesma regra.
  fieldSuggested.sort((a, b) => {
    const ra = fieldBaseRank.get(slugBase(a.slug)) ?? 99;
    const rb = fieldBaseRank.get(slugBase(b.slug)) ?? 99;
    if (ra !== rb) return ra - rb;
    return byPreferred(a, b);
  });
  suggested.sort(byPreferred);
  const finalSuggested = soIdiomaPreferido(
    [...fieldSuggested, ...suggested],
    options.preferredLanguage,
    others,
  );
  others.sort(byPreferred);

  return { suggested: finalSuggested, others };
}
