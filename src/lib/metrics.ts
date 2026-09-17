// ============================================================
// FBR Admin — Cálculos de métricas / KPIs
// ============================================================
// Recebe encomendas + vales (já filtrados por deleted_at NULL)
// e o range de datas para calcular tudo num só passo.
// As métricas baseiam-se em created_at (quando a encomenda
// entrou no sistema), excepto onde explicitamente dito.
// ============================================================

import {
  parseISO,
  isWithinInterval,
  differenceInDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  subYears,
  startOfYear,
  endOfYear,
  format,
  differenceInCalendarDays,
  differenceInHours,
  addDays,
  getYear,
  getMonth,
} from "date-fns";
import { pt } from "date-fns/locale";
import { lisbonWallClock } from "@/lib/format-date";
import type {
  Order,
  OrderStatus,
  FrameSize,
  FrameBackground,
  EventType,
  HowFoundFBR,
  FlowerDeliveryMethod,
  FrameDeliveryMethod,
  ContactPreference,
  CouponStatus,
  YesNoInfo,
  FormLanguage,
  ServiceType,
} from "@/types/database";
import {
  ORDER_STATUS_SEQUENCE,
  FORM_LANGUAGE_LABELS,
  SERVICE_TYPE_LABELS,
} from "@/types/database";
import type { Voucher } from "@/types/voucher";
import {
  commissionFullFromOrder,
  commissionFullFromVoucher,
  voucherCodesWithCommission,
  orderCommissionSuppressedByVoucher,
  revenueInPeriod,
  isConfirmedOrder,
} from "@/lib/finance";
import {
  STATUS_LABELS,
  FRAME_SIZE_LABELS,
  FRAME_BACKGROUND_LABELS,
  EVENT_TYPE_LABELS,
  HOW_FOUND_FBR_LABELS,
  FLOWER_DELIVERY_METHOD_LABELS,
  FRAME_DELIVERY_METHOD_LABELS,
  CONTACT_PREFERENCE_LABELS,
  COUPON_STATUS_LABELS,
} from "@/types/database";

// ── Date range presets ───────────────────────────────────────

export type RangePreset =
  | "desde_sempre"
  | "este_mes"
  | "mes_passado"
  | "ultimos_3_meses"
  | "ultimos_6_meses"
  | "este_ano"
  | "ano_passado"
  | "personalizado";

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  desde_sempre:    "Desde sempre",
  este_mes:        "Este mês",
  mes_passado:     "Mês passado",
  ultimos_3_meses: "Últimos 3 meses",
  ultimos_6_meses: "Últimos 6 meses",
  este_ano:        "Este ano",
  ano_passado:     "Ano passado",
  personalizado:   "Personalizado",
};

export interface DateRange {
  start: Date;
  end: Date;
}

export function rangeFromPreset(preset: RangePreset, today: Date = new Date()): DateRange | null {
  switch (preset) {
    case "desde_sempre":
      // Range artificial que apanha tudo (igual à lógica "Todos" das Finanças).
      return { start: new Date(1970, 0, 1), end: new Date(2999, 11, 31) };
    case "este_mes":
      return { start: startOfMonth(today), end: endOfMonth(today) };
    case "mes_passado": {
      const m = subMonths(today, 1);
      return { start: startOfMonth(m), end: endOfMonth(m) };
    }
    case "ultimos_3_meses":
      return { start: startOfMonth(subMonths(today, 2)), end: endOfMonth(today) };
    case "ultimos_6_meses":
      return { start: startOfMonth(subMonths(today, 5)), end: endOfMonth(today) };
    case "este_ano":
      return { start: startOfYear(today), end: endOfYear(today) };
    case "ano_passado": {
      const y = subYears(today, 1);
      return { start: startOfYear(y), end: endOfYear(y) };
    }
    case "personalizado":
      return null;
  }
}

// Devolve o range "homólogo" do ano anterior para comparação
export function previousYearRange(range: DateRange): DateRange {
  return {
    start: subYears(range.start, 1),
    end: subYears(range.end, 1),
  };
}

// Devolve o range "homólogo" do mês anterior
export function previousMonthRange(range: DateRange): DateRange {
  return {
    start: subMonths(range.start, 1),
    end: subMonths(range.end, 1),
  };
}

// Devolve o range imediatamente anterior, com a mesma duração — usado
// para comparar "Últimos 3/6 meses" ou ranges personalizados com o
// período equivalente que os precede.
export function previousEqualRange(range: DateRange): DateRange {
  const lengthMs = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - lengthMs),
    end: new Date(range.start.getTime() - 1),
  };
}

// Devolve o range "baseline" correcto para calcular variações conforme
// o preset escolhido:
//   • Mensais (este_mes, mes_passado)             → mês anterior
//   • Anuais  (este_ano, ano_passado)             → ano anterior homólogo
//   • Janelas (ultimos_3_meses, ultimos_6_meses,
//              personalizado)                      → janela equivalente anterior
//
// Antes (sessão 75): usávamos sempre `previousMonthRange`, o que dava
// percentagens sem sentido em ranges grandes (ex.: "Este ano" comparado
// com Dez–Nov do ano anterior — sobreposição).
export function baselineRangeForPreset(
  preset: RangePreset,
  range: DateRange,
): DateRange {
  switch (preset) {
    case "este_mes":
    case "mes_passado":
      return previousMonthRange(range);
    case "este_ano":
    case "ano_passado":
      return previousYearRange(range);
    case "ultimos_3_meses":
    case "ultimos_6_meses":
    case "personalizado":
      return previousEqualRange(range);
    case "desde_sempre":
      // Não há período anterior a "desde sempre" — devolvemos o próprio
      // range; a comparação é escondida na UI (ver `showComparison`).
      return range;
  }
}

// Etiqueta humana do período de comparação, conforme o preset. Vazia para
// "desde sempre" (sem comparação).
export function comparisonLabelForPreset(preset: RangePreset): string {
  switch (preset) {
    case "este_mes":
    case "mes_passado":
      return "mês anterior";
    case "este_ano":
    case "ano_passado":
      return "ano anterior";
    case "ultimos_3_meses":
    case "ultimos_6_meses":
    case "personalizado":
      return "período anterior";
    case "desde_sempre":
      return "";
  }
}

// ── Helpers de filtragem ─────────────────────────────────────

function inRange(dateStr: string | null | undefined, range: DateRange): boolean {
  if (!dateStr) return false;
  try {
    return isWithinInterval(parseISO(dateStr), { start: range.start, end: range.end });
  } catch {
    return false;
  }
}

// Encomendas criadas no range (usado para "encomendas novas" e distribuições)
function ordersIn(orders: Order[], range: DateRange): Order[] {
  return orders.filter((o) => inRange(o.created_at, range));
}

// ── Cálculos de receita ──────────────────────────────────────
// Receita = dinheiro efectivamente recebido: cada parcela (30/40/30% do
// orçamento) conta na DATA EM QUE FOI PAGA (mig 111, a mesma base das
// Finanças; ver `revenueInPeriod` em lib/finance.ts). Encomendas sem
// carimbo de pagamento caem na data do evento, como antes. CANCELADAS
// não contam. Vales: contam os 100_pago + preservacao_nao_agendada (se já
// foi convertido em preservação, contaria duas vezes); janela pela data
// de criação do vale (igual às Finanças).
// ============================================================

function voucherRevenue(v: Voucher): number {
  if (v.payment_status !== "100_pago") return 0;
  if (v.usage_status === "preservacao_agendada") return 0;
  return Number(v.amount);
}

function totalRevenue(orders: Order[], vouchers: Voucher[], range: DateRange): number {
  const ordersSum = orders.reduce((s, o) => s + revenueInPeriod(o, range.start, range.end), 0);
  const vouchersSum = vouchers
    .filter((v) => inRange(v.created_at, range))
    .reduce((s, v) => s + voucherRevenue(v), 0);
  return ordersSum + vouchersSum;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

// Pedido "confirmado" = já pagou o sinal (>= 30%), seja qual for o estado
// depois (mesmo que tenha cancelado a seguir). Definição única em finance.ts.
const isConfirmed = (o: Order): boolean => isConfirmedOrder(o);

// Funil agrupado por uma chave qualquer (canal, idioma, serviço).
function groupFunnel(
  orders: Order[],
  keyOf: (o: Order) => string,
  labelOf: (key: string) => string,
): Array<{ key: string; label: string; total: number; confirmed: number; cancelled: number; confirmedPct: number | null }> {
  const map = new Map<string, { total: number; confirmed: number; cancelled: number }>();
  for (const o of orders) {
    const key = keyOf(o);
    const cur = map.get(key) ?? { total: 0, confirmed: 0, cancelled: 0 };
    cur.total += 1;
    if (isConfirmed(o)) cur.confirmed += 1;
    if (o.status === "cancelado") cur.cancelled += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      label: labelOf(key),
      ...v,
      confirmedPct: v.total === 0 ? null : Math.round((v.confirmed / v.total) * 100),
    }))
    .sort((a, b) => b.total - a.total);
}

// ── Antecedência da reserva (pedido da Maria, sessão 174) ────
// "Com que antecedência é que os clientes reservam? Acho que há uma grande
// percentagem que só nos procura depois do casamento." Só faz sentido na
// PRESERVAÇÃO: nas flores secas e na recriação o evento é sempre no
// passado. Dias = data do evento − data do pedido (negativo = depois).
export const LEAD_TIME_BUCKETS: Array<{ key: string; label: string; test: (days: number) => boolean }> = [
  { key: "depois",   label: "Depois do evento",        test: (d) => d < 0 },
  { key: "semana",   label: "Na semana do evento",     test: (d) => d >= 0 && d <= 7 },
  { key: "mes",      label: "Até 1 mês antes",         test: (d) => d > 7 && d <= 30 },
  { key: "1_3m",     label: "1 a 3 meses antes",       test: (d) => d > 30 && d <= 90 },
  { key: "3_6m",     label: "3 a 6 meses antes",       test: (d) => d > 90 && d <= 180 },
  { key: "6m_mais",  label: "Mais de 6 meses antes",   test: (d) => d > 180 },
];

const VOUCHER_EXPIRY_HORIZON_DAYS = 90;
const QUIET_PARTNER_MONTHS = 6;

// ── Dados externos às encomendas (mig 113) ───────────────────
// Histórico de estados (order_status_history) e tempo até à 1.ª resposta
// no WhatsApp (função whatsapp_first_response). Opcionais: antes da mig
// 113 correr, a página passa listas vazias e os cartões dizem "sem dados".
export interface StatusHistoryRow {
  order_id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
}
export interface ResponseTimeRow {
  order_id: string;
  requested_at: string;
  first_reply_at: string;
  hours: number;
}
export interface MetricsExtras {
  statusHistory?: StatusHistoryRow[];
  responseTimes?: ResponseTimeRow[];
}

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/**
 * Cidade aproximada a partir da morada do evento (texto livre do Google
 * Places: "Quinta X, Rua Y, 3040-123 Coimbra, Portugal"). Fica com o
 * segmento antes de "Portugal" (ou o último), sem código postal.
 */
export function cityFromLocation(loc: string | null | undefined): string | null {
  if (!loc) return null;
  const parts = loc.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  let seg = parts[parts.length - 1];
  if (/^portugal$/i.test(seg) && parts.length >= 2) seg = parts[parts.length - 2];
  seg = seg.replace(/^\d{4}(-\d{3})?\s*/, "").trim();
  return seg || null;
}

// Chave de cliente para detectar repetentes: email (minúsculas) ou, na
// falta, os últimos 9 dígitos do telemóvel.
function clientKey(o: Pick<Order, "email" | "phone">): string | null {
  const email = (o.email ?? "").trim().toLowerCase();
  if (email) return `e:${email}`;
  const digits = (o.phone ?? "").replace(/\D/g, "");
  if (digits.length >= 9) return `t:${digits.slice(-9)}`;
  return null;
}

// ── Top-N (parceiros, canais) ────────────────────────────────

function topByCount<K extends string>(
  items: Array<K | null | undefined>,
  labels: Record<K, string>,
  n: number,
): Array<{ key: K; label: string; count: number }> {
  const counts: Map<K, number> = new Map();
  for (const it of items) {
    if (!it) continue;
    counts.set(it, (counts.get(it) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => ({ key, label: labels[key] ?? key, count }));
}

// ── Tempo médio de conclusão ─────────────────────────────────
// Da criação até frame_delivery_date (ou updated_at se não definido) das
// encomendas em "Quadro recebido".
// ============================================================

// `since` = 1.º consentimento do formulário público: as encomendas
// importadas do Monday têm created_at = dia da importação, o que dava
// tempos de conclusão falsos (auditoria da sessão 174).
function avgCompletionDays(
  orders: Order[],
  range: DateRange | null = null,
  since: string | null = null,
): number | null {
  const completed = orders.filter(
    (o) => o.status === "quadro_recebido" && (!since || o.created_at >= since),
  );
  const inRangeFilter = range
    ? completed.filter((o) => inRange(o.frame_delivery_date ?? o.updated_at, range))
    : completed;
  if (inRangeFilter.length === 0) return null;
  const totalDays = inRangeFilter.reduce((sum, o) => {
    const end = o.frame_delivery_date ?? o.updated_at;
    return sum + Math.max(0, differenceInDays(parseISO(end), parseISO(o.created_at)));
  }, 0);
  return Math.round(totalDays / inRangeFilter.length);
}

// ── Variação percentual ──────────────────────────────────────

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null; // ∞ — sinalizar com "novo"
  }
  return Math.round(((current - previous) / previous) * 100);
}

// ============================================================
// MÉTRICAS — output principal
// ============================================================

export interface MetricsResult {
  range: DateRange;
  generatedAt: string;

  // Comparação com período anterior — false em "desde sempre" (não há
  // período anterior). A UI esconde os badges de variação quando false.
  showComparison: boolean;
  comparisonLabel: string; // "mês anterior" / "ano anterior" / "período anterior"

  // Receita
  revenue: number;
  revenuePrev: number;
  revenuePctChange: number | null;
  // Receita acumulada do ano (sempre, ignorando o range)
  yearRevenue: number;
  yearRevenuePrev: number;
  yearRevenuePctChange: number | null;

  // Encomendas
  newOrders: number;
  newOrdersPrev: number;
  newOrdersPctChange: number | null;

  // Distribuição
  ordersByStatus: Array<{ status: OrderStatus; label: string; count: number }>;
  ordersByFrameSize: Array<{ key: FrameSize; label: string; count: number }>;
  ordersByFrameBackground: Array<{ key: FrameBackground; label: string; count: number }>;
  ordersByEventType: Array<{ key: EventType; label: string; count: number }>;
  topAcquisition: Array<{ key: HowFoundFBR; label: string; count: number }>;

  // Tempo médio (global e últimos 6 meses)
  avgCompletionGlobal: number | null;
  avgCompletionRecent: number | null;

  // Vales
  vouchersSold: number;
  vouchersConvertedPct: number | null;

  // Parceiros (top-5). Comissões em valor PLENO acordado (não proporcional
  // ao %pago da cliente): `paid` = estado "Paga"; `due` = obrigações ainda
  // por pagar (parceiro informado / a aguardar / a aguardar resposta);
  // `total` = paid + due. Estados "N/A" e "Não aceita" não contam.
  topPartners: Array<{
    partner_id: string;
    revenue: number;
    commissionsPaid: number;
    commissionsDue: number;
    commissionsTotal: number;
  }>;

  // Extras
  extrasOrdersPct: number;

  // Logística & comunicação
  flowerDeliveryDist: Array<{ key: FlowerDeliveryMethod; label: string; count: number }>;
  frameDeliveryDist: Array<{ key: FrameDeliveryMethod; label: string; count: number }>;
  contactPrefDist: Array<{ key: ContactPreference; label: string; count: number }>;

  // Cupões 5% — só conta encomendas onde já foi gerado (status != "na")
  couponUsageDist: Array<{ key: CouponStatus; label: string; count: number }>;

  // Upsells — quantas encomendas no período pediram cada um
  // (separado por "sim" e "mais_info" para ver intenção firme vs em aberto)
  upsellsBreakdown: Array<{
    key: "extra_small_frames" | "christmas_ornaments" | "necklace_pendants";
    label: string;
    sim: number;
    maisInfo: number;
  }>;

  // ── Funil pedido → sinal (sessão 174) ──
  // Pedidos criados no período: quantos pagaram o sinal, quantos
  // cancelaram, quantos ainda estão à espera. Por canal de aquisição.
  funnel: {
    total: number;
    confirmed: number;
    cancelled: number;
    pending: number;
    confirmedPct: number | null;
    confirmedPctPrev: number | null;
    byChannel: Array<{
      key: HowFoundFBR | "sem_resposta";
      label: string;
      total: number;
      confirmed: number;
      cancelled: number;
      confirmedPct: number | null;
    }>;
    /** Mediana de dias entre o pedido e o sinal (só com data de pagamento). */
    medianDaysToDeposit: number | null;
    depositSample: number;
    byLanguage: Array<{ key: FormLanguage | "sem_idioma"; label: string; total: number; confirmed: number; confirmedPct: number | null }>;
    byService: Array<{ key: ServiceType; label: string; total: number; confirmed: number; confirmedPct: number | null }>;
  };

  // ── Pedidos por mês (últimos 12 meses, desde o formulário) ──
  monthlyRequests: Array<{ month: string; label: string; confirmed: number; pending: number; cancelled: number }>;

  // ── Sazonalidade: eventos por mês do ano, anos sobrepostos (até 3) ──
  eventSeasonality: {
    years: number[];
    months: Array<{ month: number; label: string; counts: Record<string, number> }>;
  };

  // ── Quando chegam os pedidos (hora de Lisboa, desde o formulário) ──
  requestsByWeekday: Array<{ key: number; label: string; count: number }>;
  requestsByHour: Array<{ hour: number; label: string; count: number }>;

  // ── Cidades dos eventos (aproximadas a partir da morada) ──
  topCities: Array<{ city: string; count: number }>;

  // ── Clientes repetidos e peso das recomendações de clientes ──
  repeatClients: {
    clientsTotal: number;
    clientsRepeat: number;
    /** % dos pedidos do período feitos por quem já tinha pedido antes. */
    repeatOrdersPct: number | null;
    recommendationShareByYear: Array<{ year: number; total: number; pct: number }>;
  };

  // ── Dias em cada fase de produção (mig 113) ──
  // "done" = encomendas que já saíram da fase (quanto tempo lá ficaram);
  // "now" = encomendas que estão na fase neste momento (há quanto tempo).
  phaseDurations: Array<{
    status: OrderStatus;
    label: string;
    doneMedianDays: number | null;
    doneSample: number;
    nowCount: number;
    nowMedianDays: number | null;
  }>;

  // ── Tempo até à 1.ª resposta no WhatsApp (mig 113) ──
  whatsappResponse: {
    sample: number;
    medianHours: number | null;
    within1hPct: number | null;
    within24hPct: number | null;
    within7dPct: number | null;
    /** Pedidos com conversa cuja 1.ª mensagem tua chegou mais de 7 dias depois. */
    over7dCount: number;
  };

  // ── Cancelamentos (pedidos do período que cancelaram) ──
  cancellations: {
    count: number;
    pct: number | null;
    byPhase: Array<{ key: string; label: string; count: number }>;
  };

  // ── Antecedência da reserva (só preservação) ──
  leadTime: {
    sample: number;
    afterEventPct: number | null;
    /** Mediana de dias: positivo = antes do evento, negativo = depois. */
    medianDays: number | null;
    buckets: Array<{ key: string; label: string; count: number; pct: number }>;
    /** Data do 1.º pedido pelo formulário público (base fiável de datas). */
    since: string | null;
  };

  // ── Vales pagos, sem preservação marcada, a expirar em 3 meses ──
  expiringVouchers: Array<{
    id: string;
    code: string;
    name: string;
    amount: number;
    expiry_date: string;
    daysLeft: number;
  }>;

  // ── Canais no período anterior (para o insight "canal que caiu") ──
  acquisitionPrev: Array<{ key: HowFoundFBR; label: string; count: number }>;

  // ── Parceiros calados: com 2+ encomendas, nenhuma nos últimos 6 meses ──
  quietPartners: Array<{ partner_id: string; lastOrderAt: string; totalOrders: number }>;
}

export function computeMetrics(
  orders: Order[],
  vouchers: Voucher[],
  range: DateRange,
  today: Date = new Date(),
  preset: RangePreset = "este_mes",
  extras: MetricsExtras = {},
): MetricsResult {
  const ordersInRange = ordersIn(orders, range);
  // Baseline coerente com o preset: mês anterior para presets mensais,
  // ano anterior homólogo para anuais, janela equivalente para últimos
  // N meses e personalizado. Ver `baselineRangeForPreset`.
  const prevRange = baselineRangeForPreset(preset, range);
  const showComparison = preset !== "desde_sempre";

  // Receita
  const revenue = totalRevenue(orders, vouchers, range);
  const revenuePrev = totalRevenue(orders, vouchers, prevRange);

  // Receita do ano
  const yearRange = { start: startOfYear(today), end: endOfYear(today) };
  const yearRange1 = { start: startOfYear(subYears(today, 1)), end: endOfYear(subYears(today, 1)) };
  const yearRevenue = totalRevenue(orders, vouchers, yearRange);
  const yearRevenuePrev = totalRevenue(orders, vouchers, yearRange1);

  // Encomendas
  const newOrders = ordersInRange.length;
  const newOrdersPrev = ordersIn(orders, prevRange).length;

  // Distribuições
  // Pela ORDEM DE PRODUÇÃO (não por contagem), para se ler como um
  // pipeline; "cancelado" no fim.
  const statusRank = (s: OrderStatus) => {
    const i = ORDER_STATUS_SEQUENCE.indexOf(s);
    return i === -1 ? 999 : i;
  };
  const ordersByStatus = (Object.keys(STATUS_LABELS) as OrderStatus[])
    .map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: ordersInRange.filter((o) => o.status === status).length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => statusRank(a.status) - statusRank(b.status));

  const ordersByFrameSize = topByCount<FrameSize>(
    ordersInRange.map((o) => o.frame_size),
    FRAME_SIZE_LABELS,
    10,
  );

  const ordersByFrameBackground = topByCount<FrameBackground>(
    ordersInRange.map((o) => o.frame_background),
    FRAME_BACKGROUND_LABELS,
    10,
  );

  const ordersByEventType = topByCount<EventType>(
    ordersInRange.map((o) => o.event_type),
    EVENT_TYPE_LABELS,
    10,
  );

  const topAcquisition = topByCount<HowFoundFBR>(
    ordersInRange.map((o) => o.how_found_fbr),
    HOW_FOUND_FBR_LABELS,
    5,
  );

  // Tempo médio
  // Base fiável de datas de criação: só pedidos desde o 1.º consentimento
  // RGPD (formulário público). As importadas do Monday têm created_at do
  // dia da importação. Usado no tempo de conclusão e na antecedência.
  const consentDates = orders.map((o) => o.consent_at).filter((d): d is string => !!d).sort();
  const since = consentDates[0] ?? null;

  const avgCompletionGlobal = avgCompletionDays(orders, null, since);
  const avgCompletionRecent = avgCompletionDays(orders, {
    start: subMonths(today, 6),
    end: today,
  }, since);

  // Vales
  const vouchersInRange = vouchers.filter((v) => inRange(v.created_at, range));
  const vouchersSold = vouchersInRange.length;
  const vouchersConverted = vouchersInRange.filter(
    (v) => v.usage_status === "preservacao_agendada",
  ).length;
  const vouchersConvertedPct =
    vouchersSold === 0 ? null : Math.round((vouchersConverted / vouchersSold) * 100);

  // Top parceiros — pela mesma base da receita (data do evento, sem
  // canceladas). Comissão em valor PLENO acordado (via
  // `commissionFullFromOrder`, que já devolve 0 para "N/A"/"Não aceita"),
  // separada entre já paga (estado "Paga") e ainda por pagar.
  const partnerStats = new Map<
    string,
    { revenue: number; commissionsPaid: number; commissionsDue: number }
  >();
  // Vales que já carregam comissão contada → suprime a comissão das
  // encomendas que vieram desses vales (não recontar; ver finance.ts).
  const voucherCommissionCodes = voucherCodesWithCommission(vouchers);
  for (const o of orders) {
    // Sem sinal pago não há receita nem comissão devida (pré-reserva).
    if (!o.partner_id || o.status === "cancelado" || !isConfirmed(o)) continue;
    // Receita pela data de pagamento; a comissão entra se houve receita
    // no período ou se o evento é do período.
    const rev = revenueInPeriod(o, range.start, range.end);
    if (rev <= 0 && !inRange(o.event_date, range)) continue;
    const cur =
      partnerStats.get(o.partner_id) ??
      { revenue: 0, commissionsPaid: 0, commissionsDue: 0 };
    cur.revenue += rev;
    const fullCommission = orderCommissionSuppressedByVoucher(o, voucherCommissionCodes)
      ? 0
      : commissionFullFromOrder(o);
    if (o.partner_commission_status === "paga") {
      cur.commissionsPaid += fullCommission;
    } else {
      cur.commissionsDue += fullCommission; // 0 para na/nao_aceita
    }
    partnerStats.set(o.partner_id, cur);
  }
  // Comissões (e receita) dos vales com parceiro — contam uma única vez no
  // vale (decisão Maria, sessão 116), mesmo que o destinatário nunca reserve.
  // Período do vale = created_at, igual à receita do vale.
  for (const v of vouchers) {
    if (!v.partner_id) continue;
    if (!inRange(v.created_at, range)) continue;
    const vRevenue = voucherRevenue(v);
    const fullCommission = commissionFullFromVoucher(v);
    if (vRevenue === 0 && fullCommission === 0) continue;
    const cur =
      partnerStats.get(v.partner_id) ??
      { revenue: 0, commissionsPaid: 0, commissionsDue: 0 };
    cur.revenue += vRevenue;
    if (v.partner_commission_status === "paga") {
      cur.commissionsPaid += fullCommission;
    } else {
      cur.commissionsDue += fullCommission;
    }
    partnerStats.set(v.partner_id, cur);
  }
  const topPartners = [...partnerStats.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([partner_id, v]) => ({
      partner_id,
      ...v,
      commissionsTotal: v.commissionsPaid + v.commissionsDue,
    }));

  // Distribuição de método de envio das flores (cliente → FBR)
  const flowerDeliveryDist = topByCount<FlowerDeliveryMethod>(
    ordersInRange.map((o) => o.flower_delivery_method),
    FLOWER_DELIVERY_METHOD_LABELS,
    10,
  );

  // Distribuição de método de receção do quadro (FBR → cliente)
  const frameDeliveryDist = topByCount<FrameDeliveryMethod>(
    ordersInRange.map((o) => o.frame_delivery_method),
    FRAME_DELIVERY_METHOD_LABELS,
    10,
  );

  // Preferência de contacto
  const contactPrefDist = topByCount<ContactPreference>(
    ordersInRange.map((o) => o.contact_preference),
    CONTACT_PREFERENCE_LABELS,
    10,
  );

  // Cupões 5% — só encomendas onde o cupão já foi gerado (status != "na")
  // O cupão é criado automaticamente ao passar para "A ser emoldurado".
  const ordersWithCoupon = ordersInRange.filter((o) => o.coupon_status !== "na");
  const couponUsageDist = topByCount<CouponStatus>(
    ordersWithCoupon.map((o) => o.coupon_status),
    COUPON_STATUS_LABELS,
    10,
  );

  // Upsells — contagem de "sim" e "mais_info" por tipo de upsell
  const countByValue = (
    extract: (o: Order) => YesNoInfo | null,
  ): { sim: number; maisInfo: number } => {
    let sim = 0;
    let maisInfo = 0;
    for (const o of ordersInRange) {
      const v = extract(o);
      if (v === "sim") sim++;
      else if (v === "mais_info") maisInfo++;
    }
    return { sim, maisInfo };
  };
  const upsellsBreakdown: MetricsResult["upsellsBreakdown"] = [
    { key: "extra_small_frames",  label: "Quadros extra pequenos", ...countByValue((o) => o.extra_small_frames) },
    { key: "christmas_ornaments", label: "Ornamentos de Natal",    ...countByValue((o) => o.christmas_ornaments) },
    { key: "necklace_pendants",   label: "Pendentes para colares", ...countByValue((o) => o.necklace_pendants) },
  ];

  // % com extras
  const withExtras = ordersInRange.filter((o) => {
    const e = o.extras_in_frame;
    if (!e) return false;
    const hasOptions = (e.options ?? []).filter((x) => x !== "nao_pretendo_incluir").length > 0;
    const hasNotes = (e.notes ?? "").trim().length > 0;
    return hasOptions || hasNotes;
  }).length;
  const extrasOrdersPct =
    newOrders === 0 ? 0 : Math.round((withExtras / newOrders) * 100);

  // ── Funil pedido → sinal ──
  const pctOf = (part: number, total: number): number | null =>
    total === 0 ? null : Math.round((part / total) * 100);
  const confirmedInRange = ordersInRange.filter(isConfirmed);
  const cancelledInRange = ordersInRange.filter((o) => o.status === "cancelado");
  const prevOrders = ordersIn(orders, prevRange);
  const channelMap = new Map<
    HowFoundFBR | "sem_resposta",
    { total: number; confirmed: number; cancelled: number }
  >();
  for (const o of ordersInRange) {
    const key = o.how_found_fbr ?? "sem_resposta";
    const cur = channelMap.get(key) ?? { total: 0, confirmed: 0, cancelled: 0 };
    cur.total += 1;
    if (isConfirmed(o)) cur.confirmed += 1;
    if (o.status === "cancelado") cur.cancelled += 1;
    channelMap.set(key, cur);
  }
  const byChannel = [...channelMap.entries()]
    .map(([key, v]) => ({
      key,
      label: key === "sem_resposta" ? "Sem resposta" : HOW_FOUND_FBR_LABELS[key],
      ...v,
      confirmedPct: pctOf(v.confirmed, v.total),
    }))
    .sort((a, b) => b.total - a.total);
  const daysToDeposit = ordersInRange
    .filter((o) => o.deposit_paid_at)
    .map((o) => differenceInCalendarDays(parseISO(o.deposit_paid_at!), parseISO(o.created_at)))
    .filter((d) => d >= 0);
  const funnel: MetricsResult["funnel"] = {
    total: ordersInRange.length,
    confirmed: confirmedInRange.length,
    cancelled: cancelledInRange.length,
    pending: ordersInRange.filter((o) => !isConfirmed(o) && o.status !== "cancelado").length,
    confirmedPct: pctOf(confirmedInRange.length, ordersInRange.length),
    confirmedPctPrev: showComparison
      ? pctOf(prevOrders.filter(isConfirmed).length, prevOrders.length)
      : null,
    byChannel,
    medianDaysToDeposit: median(daysToDeposit),
    depositSample: daysToDeposit.length,
    byLanguage: groupFunnel(
      ordersInRange,
      (o) => o.form_language ?? "sem_idioma",
      (k) => (k === "sem_idioma" ? "Sem idioma" : FORM_LANGUAGE_LABELS[k as FormLanguage]),
    ) as MetricsResult["funnel"]["byLanguage"],
    byService: groupFunnel(
      ordersInRange,
      (o) => o.service_type ?? "preservacao",
      (k) => SERVICE_TYPE_LABELS[k as ServiceType],
    ) as MetricsResult["funnel"]["byService"],
  };

  // ── Cancelamentos por fase (cancelled_from_status, mig 111) ──
  const phaseMap = new Map<string, number>();
  for (const o of cancelledInRange) {
    const key = o.cancelled_from_status ?? "sem_registo";
    phaseMap.set(key, (phaseMap.get(key) ?? 0) + 1);
  }
  const cancellations: MetricsResult["cancellations"] = {
    count: cancelledInRange.length,
    pct: pctOf(cancelledInRange.length, ordersInRange.length),
    byPhase: [...phaseMap.entries()]
      .map(([key, count]) => ({
        key,
        label: key === "sem_registo" ? "Sem registo" : (STATUS_LABELS[key as OrderStatus] ?? key),
        count,
      }))
      .sort((a, b) => b.count - a.count),
  };

  // ── Antecedência da reserva (só preservação) ──
  // Base fiável: `since` (ver acima).
  const leadDays: number[] = [];
  for (const o of ordersInRange) {
    if ((o.service_type ?? "preservacao") !== "preservacao") continue;
    if (!o.event_date) continue;
    if (since && o.created_at < since) continue;
    leadDays.push(differenceInCalendarDays(parseISO(o.event_date), parseISO(o.created_at)));
  }
  const leadTime: MetricsResult["leadTime"] = {
    sample: leadDays.length,
    afterEventPct: pctOf(leadDays.filter((d) => d < 0).length, leadDays.length),
    medianDays: median(leadDays),
    buckets: LEAD_TIME_BUCKETS.map((b) => {
      const count = leadDays.filter(b.test).length;
      return { key: b.key, label: b.label, count, pct: leadDays.length === 0 ? 0 : Math.round((count / leadDays.length) * 100) };
    }),
    since,
  };

  // ── Vales a expirar em 3 meses (pagos, sem preservação marcada) ──
  const horizon = addDays(today, VOUCHER_EXPIRY_HORIZON_DAYS);
  const expiringVouchers: MetricsResult["expiringVouchers"] = vouchers
    .filter(
      (v) =>
        v.payment_status === "100_pago" &&
        v.usage_status === "preservacao_nao_agendada" &&
        !!v.expiry_date,
    )
    .map((v) => ({
      id: v.id,
      code: v.code,
      name: v.recipient_name || v.sender_name || "",
      amount: Number(v.amount),
      expiry_date: v.expiry_date,
      daysLeft: differenceInCalendarDays(parseISO(v.expiry_date), today),
    }))
    .filter((v) => v.daysLeft >= 0 && parseISO(v.expiry_date) <= horizon)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // ── Canais no período anterior ──
  const acquisitionPrev = showComparison
    ? topByCount<HowFoundFBR>(prevOrders.map((o) => o.how_found_fbr), HOW_FOUND_FBR_LABELS, 10)
    : [];

  // ── Parceiros calados ──
  const partnerOrders = new Map<string, { total: number; last: string }>();
  for (const o of orders) {
    if (!o.partner_id) continue;
    const cur = partnerOrders.get(o.partner_id) ?? { total: 0, last: o.created_at };
    cur.total += 1;
    if (o.created_at > cur.last) cur.last = o.created_at;
    partnerOrders.set(o.partner_id, cur);
  }
  const quietSince = subMonths(today, QUIET_PARTNER_MONTHS);
  const quietPartners: MetricsResult["quietPartners"] = [...partnerOrders.entries()]
    .filter(([, v]) => v.total >= 2 && parseISO(v.last) < quietSince)
    .map(([partner_id, v]) => ({ partner_id, lastOrderAt: v.last, totalOrders: v.total }))
    .sort((a, b) => a.lastOrderAt.localeCompare(b.lastOrderAt));

  // ── Pedidos por mês (últimos 12 meses), só desde o formulário ──
  const formEra = (o: Order) => !since || o.created_at >= since;
  const monthlyRequests: MetricsResult["monthlyRequests"] = [];
  for (let i = 11; i >= 0; i--) {
    const m = subMonths(today, i);
    const mr = { start: startOfMonth(m), end: endOfMonth(m) };
    const inMonth = orders.filter((o) => formEra(o) && inRange(o.created_at, mr));
    monthlyRequests.push({
      month: format(m, "yyyy-MM"),
      label: format(m, "MMM yy", { locale: pt }),
      confirmed: inMonth.filter(isConfirmed).length,
      cancelled: inMonth.filter((o) => !isConfirmed(o) && o.status === "cancelado").length,
      pending: inMonth.filter((o) => !isConfirmed(o) && o.status !== "cancelado").length,
    });
  }

  // ── Sazonalidade dos eventos (não canceladas), até 3 anos ──
  const seasonYears = new Set<number>();
  for (const o of orders) {
    if (o.status === "cancelado" || !o.event_date) continue;
    seasonYears.add(getYear(parseISO(o.event_date)));
  }
  const years = [...seasonYears].sort((a, b) => b - a).slice(0, 3).sort((a, b) => a - b);
  const seasonMonths: MetricsResult["eventSeasonality"]["months"] = Array.from({ length: 12 }, (_, i) => {
    const label = format(new Date(2026, i, 1), "MMM", { locale: pt });
    const counts: Record<string, number> = {};
    for (const y of years) counts[String(y)] = 0;
    return { month: i + 1, label: label.charAt(0).toUpperCase() + label.slice(1), counts };
  });
  for (const o of orders) {
    if (o.status === "cancelado" || !o.event_date) continue;
    const d = parseISO(o.event_date);
    const y = String(getYear(d));
    if (!(y in seasonMonths[0].counts)) continue;
    seasonMonths[getMonth(d)].counts[y] += 1;
  }
  const eventSeasonality: MetricsResult["eventSeasonality"] = { years, months: seasonMonths };

  // ── Quando chegam os pedidos (hora de Lisboa), no período e desde o formulário ──
  const weekdayCounts = Array(7).fill(0) as number[];
  const hourCounts = Array(24).fill(0) as number[];
  for (const o of ordersInRange) {
    if (!formEra(o)) continue;
    const wall = lisbonWallClock(parseISO(o.created_at));
    weekdayCounts[(wall.getDay() + 6) % 7] += 1;
    hourCounts[wall.getHours()] += 1;
  }
  const requestsByWeekday = weekdayCounts.map((count, key) => ({ key, label: WEEKDAY_LABELS[key], count }));
  const requestsByHour = hourCounts.map((count, hour) => ({ hour, label: `${String(hour).padStart(2, "0")}h`, count }));

  // ── Cidades dos eventos (pedidos do período) ──
  const cityCounts = new Map<string, number>();
  for (const o of ordersInRange) {
    const city = cityFromLocation(o.event_location);
    if (!city) continue;
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  }
  const topCities = [...cityCounts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ── Clientes repetidos ──
  const byClient = new Map<string, string[]>(); // key → created_at das encomendas
  for (const o of orders) {
    const k = clientKey(o);
    if (!k) continue;
    const list = byClient.get(k) ?? [];
    list.push(o.created_at);
    byClient.set(k, list);
  }
  let repeatOrders = 0;
  let keyedInRange = 0;
  for (const o of ordersInRange) {
    const k = clientKey(o);
    if (!k) continue;
    keyedInRange += 1;
    if ((byClient.get(k) ?? []).some((c) => c < o.created_at)) repeatOrders += 1;
  }
  const recByYear = new Map<number, { total: number; rec: number }>();
  for (const o of orders) {
    if (!formEra(o)) continue;
    const y = getYear(parseISO(o.created_at));
    const cur = recByYear.get(y) ?? { total: 0, rec: 0 };
    cur.total += 1;
    if (o.how_found_fbr === "recomendacao") cur.rec += 1;
    recByYear.set(y, cur);
  }
  const repeatClients: MetricsResult["repeatClients"] = {
    clientsTotal: byClient.size,
    clientsRepeat: [...byClient.values()].filter((l) => l.length >= 2).length,
    repeatOrdersPct: pctOf(repeatOrders, keyedInRange),
    recommendationShareByYear: [...recByYear.entries()]
      .map(([year, v]) => ({ year, total: v.total, pct: v.total === 0 ? 0 : Math.round((v.rec / v.total) * 100) }))
      .sort((a, b) => a.year - b.year),
  };

  // ── Dias em cada fase (histórico de estados) ──
  // Todas as encomendas não canceladas contam. Nas importadas do Monday a
  // 1.ª linha (criação) tem a data da importação, por isso o segmento que
  // começa nela é ignorado; as transições seguintes são reais.
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const historyByOrder = new Map<string, StatusHistoryRow[]>();
  for (const h of extras.statusHistory ?? []) {
    const o = orderById.get(h.order_id);
    if (!o || o.status === "cancelado") continue;
    const list = historyByOrder.get(h.order_id) ?? [];
    list.push(h);
    historyByOrder.set(h.order_id, list);
  }
  const doneDays = new Map<OrderStatus, number[]>();
  const nowDays = new Map<OrderStatus, number[]>();
  const medianOf = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const med = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return Math.round(med * 10) / 10;
  };
  for (const [orderId, list] of historyByOrder.entries()) {
    const o = orderById.get(orderId)!;
    list.sort((a, b) => a.changed_at.localeCompare(b.changed_at));
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      if (row.from_status === null && !formEra(o)) continue; // criação com data falsa
      const status = row.to_status as OrderStatus;
      if (i < list.length - 1) {
        const hours = differenceInHours(parseISO(list[i + 1].changed_at), parseISO(row.changed_at));
        if (hours < 0) continue;
        const arr = doneDays.get(status) ?? [];
        arr.push(Math.round((hours / 24) * 10) / 10);
        doneDays.set(status, arr);
      } else if (o.status === status && status !== "quadro_recebido") {
        // Fase actual: há quanto tempo está nela (a data do último estado
        // é a da mudança, mesmo que o histórico tenha sido preenchido depois).
        const hours = differenceInHours(today, parseISO(row.changed_at));
        if (hours < 0) continue;
        const arr = nowDays.get(status) ?? [];
        arr.push(Math.round((hours / 24) * 10) / 10);
        nowDays.set(status, arr);
      }
    }
  }
  const phaseDurations: MetricsResult["phaseDurations"] = ORDER_STATUS_SEQUENCE
    .filter((s) => (doneDays.get(s) ?? []).length > 0 || (nowDays.get(s) ?? []).length > 0)
    .map((s) => ({
      status: s,
      label: STATUS_LABELS[s],
      doneMedianDays: medianOf(doneDays.get(s) ?? []),
      doneSample: (doneDays.get(s) ?? []).length,
      nowCount: (nowDays.get(s) ?? []).length,
      nowMedianDays: medianOf(nowDays.get(s) ?? []),
    }));

  // ── Tempo até à 1.ª resposta no WhatsApp (pedidos do período) ──
  // Aproximação: 1.ª mensagem enviada na conversa com o mesmo telemóvel
  // depois do pedido. Quando a resposta foi por email/Instagram, a 1.ª
  // mensagem no WhatsApp pode chegar semanas depois sobre outra coisa;
  // daí contar à parte os "mais de 7 dias" em vez de os deixar puxar
  // as medianas.
  const respHours = (extras.responseTimes ?? [])
    .filter((r) => orderById.has(r.order_id) && inRange(r.requested_at, range))
    .map((r) => Number(r.hours))
    .filter((h) => Number.isFinite(h) && h >= 0)
    .sort((a, b) => a - b);
  const whatsappResponse: MetricsResult["whatsappResponse"] = {
    sample: respHours.length,
    medianHours: medianOf(respHours),
    within1hPct: pctOf(respHours.filter((h) => h <= 1).length, respHours.length),
    within24hPct: pctOf(respHours.filter((h) => h <= 24).length, respHours.length),
    within7dPct: pctOf(respHours.filter((h) => h <= 24 * 7).length, respHours.length),
    over7dCount: respHours.filter((h) => h > 24 * 7).length,
  };

  return {
    range,
    generatedAt: new Date().toISOString(),
    funnel,
    cancellations,
    leadTime,
    expiringVouchers,
    acquisitionPrev,
    quietPartners,
    monthlyRequests,
    eventSeasonality,
    requestsByWeekday,
    requestsByHour,
    topCities,
    repeatClients,
    phaseDurations,
    whatsappResponse,
    showComparison,
    comparisonLabel: comparisonLabelForPreset(preset),
    revenue,
    revenuePrev,
    revenuePctChange: pctChange(revenue, revenuePrev),
    yearRevenue,
    yearRevenuePrev,
    yearRevenuePctChange: pctChange(yearRevenue, yearRevenuePrev),
    newOrders,
    newOrdersPrev,
    newOrdersPctChange: pctChange(newOrders, newOrdersPrev),
    ordersByStatus,
    ordersByFrameSize,
    ordersByFrameBackground,
    ordersByEventType,
    topAcquisition,
    avgCompletionGlobal,
    avgCompletionRecent,
    vouchersSold,
    vouchersConvertedPct,
    topPartners,
    extrasOrdersPct,
    flowerDeliveryDist,
    frameDeliveryDist,
    contactPrefDist,
    couponUsageDist,
    upsellsBreakdown,
  };
}

// ── Insights automáticos ─────────────────────────────────────
// Análise simples: detecta variações grandes e devolve frases.
// ============================================================

export function generateInsights(
  m: MetricsResult,
  partnerNames: Record<string, string> = {},
): string[] {
  const out: string[] = [];

  // Só frases que mudam alguma coisa: quedas, fugas, oportunidades. O que
  // é constante (tamanho mais vendido) já está nos gráficos.
  if (m.revenuePctChange !== null && Math.abs(m.revenuePctChange) >= 20) {
    out.push(
      m.revenuePctChange > 0
        ? `Receita subiu ${m.revenuePctChange}% face ao período anterior 🎉`
        : `Receita caiu ${Math.abs(m.revenuePctChange)}% face ao período anterior — vale a pena investigar.`,
    );
  }

  if (m.newOrdersPctChange !== null && Math.abs(m.newOrdersPctChange) >= 25) {
    out.push(
      m.newOrdersPctChange > 0
        ? `${m.newOrdersPctChange}% mais pedidos que o período anterior.`
        : `${Math.abs(m.newOrdersPctChange)}% menos pedidos que o período anterior.`,
    );
  }

  // Funil: taxa de confirmação e a sua variação.
  if (m.funnel.total >= 5 && m.funnel.confirmedPct !== null) {
    if (m.funnel.confirmedPctPrev !== null) {
      const diff = m.funnel.confirmedPct - m.funnel.confirmedPctPrev;
      if (Math.abs(diff) >= 10) {
        out.push(
          diff > 0
            ? `A taxa de confirmação subiu ${diff} pontos (${m.funnel.confirmedPct}% dos pedidos pagaram sinal, contra ${m.funnel.confirmedPctPrev}%).`
            : `A taxa de confirmação caiu ${Math.abs(diff)} pontos (${m.funnel.confirmedPct}% dos pedidos pagaram sinal, contra ${m.funnel.confirmedPctPrev}%) — ver o que mudou no formulário ou no primeiro contacto.`,
        );
      }
    } else if (m.funnel.confirmedPct < 50) {
      out.push(`Só ${m.funnel.confirmedPct}% dos pedidos do período pagaram sinal; ${m.funnel.pending} continuam à espera.`);
    }
  }

  // Canal que mais caiu face ao período anterior.
  if (m.acquisitionPrev.length > 0) {
    let worst: { label: string; current: number; prev: number } | null = null;
    for (const p of m.acquisitionPrev) {
      if (p.count < 3) continue;
      const current = m.topAcquisition.find((c) => c.key === p.key)?.count ?? 0;
      if (current <= p.count / 2 && (!worst || p.count - current > worst.prev - worst.current)) {
        worst = { label: p.label, current, prev: p.count };
      }
    }
    if (worst) {
      out.push(`${worst.label} trouxe ${worst.current} pedido${worst.current === 1 ? "" : "s"}, contra ${worst.prev} no período anterior.`);
    }
  }

  if (m.topAcquisition.length > 0) {
    const top = m.topAcquisition[0];
    const total = m.topAcquisition.reduce((s, x) => s + x.count, 0);
    const pct = total === 0 ? 0 : Math.round((top.count / total) * 100);
    if (pct >= 60) {
      out.push(`${top.label} é ${pct}% dos pedidos: depender tanto de um canal é um risco.`);
    }
  }

  // Cancelamentos.
  if (m.cancellations.count >= 3 && m.cancellations.pct !== null && m.cancellations.pct >= 15) {
    const phase = m.cancellations.byPhase[0];
    out.push(
      `${m.cancellations.pct}% dos pedidos do período cancelaram (${m.cancellations.count})` +
        (phase && phase.key !== "sem_registo" ? `, a maior parte em "${phase.label}".` : "."),
    );
  }

  // Antecedência (só preservação).
  if (m.leadTime.sample >= 5 && m.leadTime.afterEventPct !== null) {
    if (m.leadTime.afterEventPct >= 25) {
      out.push(
        `${m.leadTime.afterEventPct}% dos pedidos de preservação chegam depois do evento: vale a pena dizer no site e nas redes que preservar depois do casamento é possível.`,
      );
    } else if (m.leadTime.medianDays !== null && m.leadTime.medianDays > 0) {
      out.push(`Os pedidos de preservação chegam, em mediana, ${m.leadTime.medianDays} dias antes do evento.`);
    }
  }

  // Vales.
  if (m.expiringVouchers.length > 0) {
    out.push(
      `${m.expiringVouchers.length} vale${m.expiringVouchers.length === 1 ? "" : "s"} pago${m.expiringVouchers.length === 1 ? "" : "s"} sem preservação marcada expira${m.expiringVouchers.length === 1 ? "" : "m"} nos próximos 3 meses — relembrar.`,
    );
  } else if (m.vouchersSold > 0 && m.vouchersConvertedPct !== null) {
    if (m.vouchersConvertedPct >= 50) {
      out.push(`Boa conversão de vales: ${m.vouchersConvertedPct}% já agendaram preservação.`);
    } else if (m.vouchersConvertedPct < 20 && m.vouchersSold >= 3) {
      out.push(`Só ${m.vouchersConvertedPct}% dos vales foram convertidos — talvez relembrar os clientes.`);
    }
  }

  // Resposta no WhatsApp.
  if (m.whatsappResponse.sample >= 5 && m.whatsappResponse.medianHours !== null) {
    if (m.whatsappResponse.medianHours > 24) {
      out.push(`A primeira resposta no WhatsApp demora, em mediana, ${m.whatsappResponse.medianHours} h. Responder no próprio dia costuma pesar na decisão.`);
    } else if (m.whatsappResponse.within1hPct !== null && m.whatsappResponse.within1hPct >= 50) {
      out.push(`${m.whatsappResponse.within1hPct}% dos pedidos têm resposta no WhatsApp em menos de 1 hora 👏`);
    }
  }

  // Fase onde as encomendas mais ficam paradas (já concluídas, com amostra).
  if (m.phaseDurations.length > 0) {
    const slowest = [...m.phaseDurations]
      .filter((p) => p.doneSample >= 3 && p.doneMedianDays !== null)
      .sort((a, b) => (b.doneMedianDays ?? 0) - (a.doneMedianDays ?? 0))[0];
    if (slowest && (slowest.doneMedianDays ?? 0) >= 30 && slowest.status !== "flores_na_prensa") {
      out.push(`A fase onde as encomendas mais ficam é "${slowest.label}": ${slowest.doneMedianDays} dias em mediana (${slowest.doneSample} encomendas).`);
    }
  }

  // Clientes repetidos.
  if (m.repeatClients.repeatOrdersPct !== null && m.repeatClients.repeatOrdersPct >= 15 && m.funnel.total >= 5) {
    out.push(`${m.repeatClients.repeatOrdersPct}% dos pedidos do período são de clientes que já tinham pedido antes.`);
  }

  // Parceiros que deixaram de recomendar.
  if (m.quietPartners.length > 0) {
    const names = m.quietPartners
      .slice(0, 4)
      .map((p) => partnerNames[p.partner_id] ?? "parceiro sem nome")
      .join(", ");
    out.push(
      `Parceiros sem recomendações há mais de 6 meses: ${names}${m.quietPartners.length > 4 ? ` (+${m.quietPartners.length - 4})` : ""}. Um contacto pode reactivar.`,
    );
  }

  if (m.avgCompletionGlobal && m.avgCompletionRecent) {
    const diff = m.avgCompletionRecent - m.avgCompletionGlobal;
    if (Math.abs(diff) >= 7) {
      out.push(
        diff > 0
          ? `Tempo médio de conclusão recente subiu ${diff} dias face à média global.`
          : `Tempo médio de conclusão recente desceu ${Math.abs(diff)} dias face à média global — bom trabalho!`,
      );
    }
  }

  return out;
}

// ── Histórico mensal de receita ──────────────────────────────
// Usado pelo gráfico de barras: últimos 12 meses.

export interface MonthRevenue {
  month: string;        // YYYY-MM
  label: string;        // "Jan 2026"
  revenue: number;
}

export function monthlyRevenue(
  orders: Order[],
  vouchers: Voucher[],
  monthsBack: number = 12,
  today: Date = new Date(),
): MonthRevenue[] {
  const out: MonthRevenue[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const m = subMonths(today, i);
    const range = { start: startOfMonth(m), end: endOfMonth(m) };
    out.push({
      month: format(m, "yyyy-MM"),
      label: format(m, "MMM yy", { locale: pt }),
      revenue: totalRevenue(orders, vouchers, range),
    });
  }
  return out;
}
