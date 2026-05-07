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
} from "date-fns";
import type { Order, OrderStatus, FrameSize, FrameBackground, EventType, HowFoundFBR } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import { STATUS_LABELS, FRAME_SIZE_LABELS, FRAME_BACKGROUND_LABELS, EVENT_TYPE_LABELS, HOW_FOUND_FBR_LABELS } from "@/types/database";

// ── Date range presets ───────────────────────────────────────

export type RangePreset =
  | "este_mes"
  | "mes_passado"
  | "ultimos_3_meses"
  | "ultimos_6_meses"
  | "este_ano"
  | "ano_passado"
  | "personalizado";

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
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

// ── Helpers de filtragem ─────────────────────────────────────

function inRange(dateStr: string | null | undefined, range: DateRange): boolean {
  if (!dateStr) return false;
  try {
    return isWithinInterval(parseISO(dateStr), { start: range.start, end: range.end });
  } catch {
    return false;
  }
}

// Encomendas criadas no range
function ordersIn(orders: Order[], range: DateRange): Order[] {
  return orders.filter((o) => inRange(o.created_at, range));
}

// ── Cálculos de receita ──────────────────────────────────────
// Receita = soma do orçamento das encomendas COM PELO MENOS 30% pago.
// Isto reflecte a faturação efectiva (não receita potencial).
// Vales: contam para receita os 100_pago + preservacao_nao_agendada
// (se já foi convertido em preservação, contaria duas vezes).
// ============================================================

const PAID_STATUSES = new Set(["100_pago", "70_pago", "30_pago"]);

function orderRevenue(o: Order): number {
  if (!o.budget) return 0;
  if (!PAID_STATUSES.has(o.payment_status)) return 0;
  return Number(o.budget);
}

function voucherRevenue(v: Voucher): number {
  if (v.payment_status !== "100_pago") return 0;
  if (v.usage_status === "preservacao_agendada") return 0;
  return Number(v.amount);
}

function totalRevenue(orders: Order[], vouchers: Voucher[], range: DateRange): number {
  const ordersSum = ordersIn(orders, range).reduce((s, o) => s + orderRevenue(o), 0);
  const vouchersSum = vouchers
    .filter((v) => inRange(v.created_at, range))
    .reduce((s, v) => s + voucherRevenue(v), 0);
  return ordersSum + vouchersSum;
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

function avgCompletionDays(orders: Order[], range: DateRange | null = null): number | null {
  const completed = orders.filter((o) => o.status === "quadro_recebido");
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

  // Parceiros (top-5)
  topPartners: Array<{ partner_id: string; revenue: number; commissions: number }>;

  // Extras
  extrasOrdersPct: number;
}

export function computeMetrics(
  orders: Order[],
  vouchers: Voucher[],
  range: DateRange,
  today: Date = new Date(),
): MetricsResult {
  const ordersInRange = ordersIn(orders, range);
  const prevRange = previousMonthRange(range);
  const prevYearRange = previousYearRange(range);

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
  const ordersByStatus = (Object.keys(STATUS_LABELS) as OrderStatus[])
    .map((status) => ({
      status,
      label: STATUS_LABELS[status],
      count: ordersInRange.filter((o) => o.status === status).length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

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
  const avgCompletionGlobal = avgCompletionDays(orders);
  const avgCompletionRecent = avgCompletionDays(orders, {
    start: subMonths(today, 6),
    end: today,
  });

  // Vales
  const vouchersInRange = vouchers.filter((v) => inRange(v.created_at, range));
  const vouchersSold = vouchersInRange.length;
  const vouchersConverted = vouchersInRange.filter(
    (v) => v.usage_status === "preservacao_agendada",
  ).length;
  const vouchersConvertedPct =
    vouchersSold === 0 ? null : Math.round((vouchersConverted / vouchersSold) * 100);

  // Top parceiros
  const partnerStats = new Map<string, { revenue: number; commissions: number }>();
  for (const o of ordersInRange) {
    if (!o.partner_id) continue;
    const cur = partnerStats.get(o.partner_id) ?? { revenue: 0, commissions: 0 };
    cur.revenue += orderRevenue(o);
    cur.commissions += Number(o.partner_commission ?? 0);
    partnerStats.set(o.partner_id, cur);
  }
  const topPartners = [...partnerStats.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([partner_id, v]) => ({ partner_id, ...v }));

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

  return {
    range,
    generatedAt: new Date().toISOString(),
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
  };
}

// ── Insights automáticos ─────────────────────────────────────
// Análise simples: detecta variações grandes e devolve frases.
// ============================================================

export function generateInsights(m: MetricsResult): string[] {
  const out: string[] = [];

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
        ? `${m.newOrdersPctChange}% mais encomendas que o período anterior.`
        : `${Math.abs(m.newOrdersPctChange)}% menos encomendas que o período anterior.`,
    );
  }

  if (m.topAcquisition.length > 0) {
    const top = m.topAcquisition[0];
    const total = m.topAcquisition.reduce((s, x) => s + x.count, 0);
    const pct = total === 0 ? 0 : Math.round((top.count / total) * 100);
    if (pct >= 40) {
      out.push(`${top.label} é o canal dominante (${pct}% das encomendas).`);
    }
  }

  if (m.vouchersSold > 0 && m.vouchersConvertedPct !== null) {
    if (m.vouchersConvertedPct >= 50) {
      out.push(`Boa conversão de vales: ${m.vouchersConvertedPct}% já agendaram preservação.`);
    } else if (m.vouchersConvertedPct < 20 && m.vouchersSold >= 3) {
      out.push(`Só ${m.vouchersConvertedPct}% dos vales foram convertidos — talvez relembrar os clientes.`);
    }
  }

  if (m.ordersByFrameSize.length > 0) {
    const top = m.ordersByFrameSize[0];
    out.push(`Tamanho mais escolhido: ${top.label} (${top.count} encomendas).`);
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
      label: format(m, "MMM yy", { locale: undefined }),
      revenue: totalRevenue(orders, vouchers, range),
    });
  }
  return out;
}
