"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Euro,
  Tags,
  Receipt,
  TrendingUp,
  Swords,
  Plus,
  ExternalLink,
  MapPin,
  Globe,
  Trash2,
  Save,
  X,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Calendar as CalendarIcon,
  RotateCw,
  Paperclip,
  Upload,
  Sparkles,
  Frame,
  Camera,
  Package,
  Handshake,
  Pencil,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, getYear } from "date-fns";
import { pt } from "date-fns/locale";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatEUR } from "@/lib/format";
import { toast } from "sonner";

import type { Competitor, CompetitorPrice } from "@/types/competitor";
import type { PricingItem } from "@/types/pricing";
import type {
  ProductionCostItem,
  ProductionCostSize,
  ProductionFrameType,
  ProductionGlassType,
} from "@/types/production-cost";
import {
  PRODUCTION_SIZE_LABELS,
  PRODUCTION_FRAME_TYPE_LABELS,
  PRODUCTION_FRAME_TYPE_SHORT,
  PRODUCTION_GLASS_TYPE_LABELS,
} from "@/types/production-cost";
import { computeProductionCost } from "@/lib/production-cost";
import {
  commissionFromOrder,
  cogsRecognizedFromOrder,
  orderPnL,
  paidRatio as paidRatioOf,
  aggregateExpensesByAccountingType,
  ACCOUNTING_TYPE_LABELS,
} from "@/lib/finance";
import { STATUS_LABELS, FRAME_SIZE_LABELS, FRAME_BACKGROUND_LABELS } from "@/types/database";
import type { OrderStatus, FrameSize, FrameBackground } from "@/types/database";
import type { Expense, ExpenseCategory, ExpensePaymentMethod, ExpenseRecurrencePeriod } from "@/types/expense";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORY_ORDER,
  EXPENSE_PAYMENT_METHOD_LABELS,
  EXPENSE_RECURRENCE_PERIOD_LABELS,
  monthlyEquivalent,
  isSubscriptionActive,
  subscriptionTotalToDate,
} from "@/types/expense";
import {
  createCompetitorAction,
  updateCompetitorAction,
  archiveCompetitorAction,
  updatePricingItemAction,
  updateProductionCostItemAction,
  createConsumableAction,
  archiveConsumableAction,
  renameConsumableAction,
  createExpenseAction,
  updateExpenseAction,
  archiveExpenseAction,
  uploadExpenseInvoiceAction,
} from "./actions";

type TabKey = "painel" | "pnl" | "catalogo" | "despesas" | "faturacao" | "competicao";

interface TabDef {
  key: TabKey;
  label: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string; // tailwind classes para o ícone quando inactivo
  bgInactive: string; // background do ícone quando inactivo
}

const TABS: TabDef[] = [
  {
    key: "painel",
    label: "Painel",
    helper: "Resumo executivo do mês",
    icon: Sparkles,
    accent: "text-emerald-600",
    bgInactive: "bg-emerald-100",
  },
  {
    key: "pnl",
    label: "P&L por encomenda",
    helper: "Margem por quadro",
    icon: Frame,
    accent: "text-amber-600",
    bgInactive: "bg-amber-100",
  },
  {
    key: "catalogo",
    label: "Catálogo",
    helper: "Preços, custos e margem teórica",
    icon: Tags,
    accent: "text-sky-600",
    bgInactive: "bg-sky-100",
  },
  {
    key: "despesas",
    label: "Despesas",
    helper: "Subscrições e gastos únicos",
    icon: Receipt,
    accent: "text-rose-600",
    bgInactive: "bg-rose-100",
  },
  {
    key: "faturacao",
    label: "Faturação",
    helper: "Receita e lucro mensal",
    icon: TrendingUp,
    accent: "text-emerald-600",
    bgInactive: "bg-emerald-100",
  },
  {
    key: "competicao",
    label: "Competição",
    helper: "Concorrentes e preços",
    icon: Swords,
    accent: "text-violet-600",
    bgInactive: "bg-violet-100",
  },
];


interface Props {
  initialCompetitors: Competitor[];
  initialPricing: PricingItem[];
  initialProductionCosts: ProductionCostItem[];
  initialExpenses: Expense[];
  orders: Array<Pick<import("@/types/database").Order, "id" | "order_id" | "client_name" | "created_at" | "event_date" | "status" | "payment_status" | "budget" | "frame_delivery_date" | "frame_size" | "frame_background" | "pyramid_frame" | "frame_internal_type" | "extra_small_frames" | "extra_small_frames_qty" | "production_cost_snapshot" | "partner_commission" | "partner_commission_status">>;
  vouchers: Array<Pick<import("@/types/voucher").Voucher, "id" | "code" | "created_at" | "amount" | "payment_status" | "usage_status">>;
  canEdit: boolean;
}

export default function FinancasClient({
  initialCompetitors,
  initialPricing,
  initialProductionCosts,
  initialExpenses,
  orders,
  vouchers,
  canEdit,
}: Props) {
  const [tab, setTab] = useState<TabKey>("painel");

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-sm flex items-center justify-center">
          <Euro className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-cocoa-900">
          Finanças
        </h1>
      </div>

      {/* Tabs como cartões grandes — visíveis e claros */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {TABS.map((t) => {
          const active = t.key === tab;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "group relative flex items-center gap-3 p-3 sm:p-4 rounded-2xl border-2 text-left transition-all",
                active
                  ? "border-cocoa-900 bg-cocoa-900 text-surface shadow-md dark:border-[#E8D5B5] dark:bg-[#E8D5B5] dark:text-[#1B1611]"
                  : "border-cream-200 bg-surface text-cocoa-900 hover:border-cocoa-500 hover:shadow-sm",
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-xl flex items-center justify-center transition-colors",
                  active
                    ? "bg-surface/15 dark:bg-[#1B1611]/15"
                    : t.bgInactive,
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 sm:h-6 sm:w-6",
                    active ? "text-surface dark:text-[#1B1611]" : t.accent,
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm sm:text-base font-semibold leading-tight">
                  {t.label}
                </div>
                <div
                  className={cn(
                    "text-[11px] sm:text-xs mt-0.5 leading-tight",
                    active ? "opacity-80" : "text-cocoa-700",
                  )}
                >
                  {t.helper}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {tab === "painel"    && <PainelTab orders={orders} vouchers={vouchers} expenses={initialExpenses} />}
      {tab === "pnl"       && <PnLTab orders={orders} />}
      {tab === "catalogo"  && <CatalogoTab pricing={initialPricing} productionCosts={initialProductionCosts} canEdit={canEdit} />}
      {tab === "despesas"  && <DespesasTab expenses={initialExpenses} canEdit={canEdit} />}
      {tab === "faturacao" && <FaturacaoTab orders={orders} vouchers={vouchers} expenses={initialExpenses} />}
      {tab === "competicao" && (
        <CompeticaoTab competitors={initialCompetitors} canEdit={canEdit} />
      )}
    </div>
  );
}

// ============================================================
// PAINEL (resumo executivo)
// ============================================================

function inRangeISO(iso: string | null, start: Date, end: Date): boolean {
  if (!iso) return false;
  const d = parseISO(iso);
  return d >= start && d <= end;
}

function PainelTab({
  orders,
  vouchers,
  expenses,
}: {
  orders: FaturacaoOrder[];
  vouchers: FaturacaoVoucher[];
  expenses: Expense[];
}) {
  const now = useMemo(() => new Date(), []);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));
  const yearStart = startOfYear(now);
  const yearEnd = endOfYear(now);
  const currentYear = getYear(now);

  // ── Agregação genérica de um período ──
  const aggregate = (start: Date, end: Date) => {
    const ordersInRange = orders.filter((o) => inRangeISO(o.event_date, start, end));
    let revenueGross = 0;
    let cogs = 0;
    let commission = 0;
    let orderCount = 0;
    let completedCount = 0;
    for (const o of ordersInRange) {
      if (o.status === "cancelado") continue;
      const p = orderPnL(o);
      revenueGross += p.revenue_recognized;
      cogs += p.cogs_recognized;
      commission += p.commission_recognized;
      orderCount += 1;
      if (o.status === "quadro_recebido") completedCount += 1;
    }
    // Vales 100% pagos não convertidos somam à receita
    const voucherRevenue = vouchers
      .filter((v) => inRangeISO(v.created_at, start, end))
      .filter((v) => v.payment_status === "100_pago" && v.usage_status !== "preservacao_agendada")
      .reduce((s, v) => s + Number(v.amount), 0);
    revenueGross += voucherRevenue;
    const expensesInRange = expenses.filter((e) => inRangeISO(e.expense_date, start, end));
    const expensesTotal = expensesInRange.reduce((s, e) => s + Number(e.amount), 0);
    const expensesByType = aggregateExpensesByAccountingType(expensesInRange);
    const revenueNet = revenueGross - commission;
    const profit = revenueGross - cogs - commission - expensesTotal;
    const marginPct = revenueGross > 0 ? (profit / revenueGross) * 100 : 0;
    return {
      revenueGross,
      revenueNet,
      cogs,
      commission,
      expensesTotal,
      expensesByType,
      profit,
      marginPct,
      orderCount,
      completedCount,
    };
  };

  const month = useMemo(() => aggregate(monthStart, monthEnd), [orders, vouchers, expenses, monthStart, monthEnd]);
  const prevMonth = useMemo(() => aggregate(prevMonthStart, prevMonthEnd), [orders, vouchers, expenses, prevMonthStart, prevMonthEnd]);
  const year = useMemo(() => aggregate(yearStart, yearEnd), [orders, vouchers, expenses, yearStart, yearEnd]);

  const revenueDelta = prevMonth.revenueGross > 0
    ? ((month.revenueGross - prevMonth.revenueGross) / prevMonth.revenueGross) * 100
    : null;
  const profitDelta = prevMonth.profit !== 0
    ? ((month.profit - prevMonth.profit) / Math.abs(prevMonth.profit)) * 100
    : null;

  // ── Quadro mais lucrativo do mês ──
  const mostProfitableThisMonth = useMemo(() => {
    let best: { order: FaturacaoOrder; pnl: ReturnType<typeof orderPnL> } | null = null;
    for (const o of orders) {
      if (!inRangeISO(o.event_date, monthStart, monthEnd)) continue;
      if (o.status === "cancelado") continue;
      const p = orderPnL(o);
      if (!best || p.margin_full > best.pnl.margin_full) best = { order: o, pnl: p };
    }
    return best;
  }, [orders, monthStart, monthEnd]);

  // ── Ticket médio ──
  const ticketAvg = month.orderCount > 0 ? month.revenueGross / month.orderCount : 0;

  // ── Pipeline pendente (não recebido) ──
  const pendingPipeline = useMemo(() => {
    let total = 0;
    for (const o of orders) {
      if (o.status === "cancelado") continue;
      if (o.status === "quadro_recebido") continue;
      total += Number(o.budget) || 0;
    }
    return total;
  }, [orders]);

  // ── Conversão vale → preservação ──
  const voucherConversion = useMemo(() => {
    const totalVouchers = vouchers.filter((v) => v.payment_status === "100_pago").length;
    if (totalVouchers === 0) return null;
    const converted = vouchers.filter((v) => v.usage_status === "preservacao_agendada").length;
    return (converted / totalVouchers) * 100;
  }, [vouchers]);

  // ── Ranking por tamanho de moldura ──
  const rankingBySize = useMemo(() => {
    const groups = new Map<string, { label: string; count: number; revenue: number; cogs: number; commission: number; margin: number }>();
    const ensure = (key: string, label: string) => {
      if (!groups.has(key)) groups.set(key, { label, count: 0, revenue: 0, cogs: 0, commission: 0, margin: 0 });
      return groups.get(key)!;
    };
    for (const o of orders) {
      if (!inRangeISO(o.event_date, yearStart, yearEnd)) continue;
      if (o.status === "cancelado") continue;
      const p = orderPnL(o);
      const key = o.pyramid_frame ? "piramide" : (o.frame_size ?? "indef");
      const label = o.pyramid_frame
        ? "Pirâmide"
        : o.frame_size && o.frame_size in FRAME_SIZE_LABELS
          ? FRAME_SIZE_LABELS[o.frame_size as FrameSize]
          : "Por definir";
      const g = ensure(key, label);
      g.count += 1;
      g.revenue += p.revenue_full;
      g.cogs += p.cogs_full;
      g.commission += p.commission_full;
      g.margin += p.margin_full;
    }
    return [...groups.values()].sort((a, b) => b.margin - a.margin);
  }, [orders, yearStart, yearEnd]);

  // ── Ranking por tipo de fundo ──
  const rankingByBackground = useMemo(() => {
    const groups = new Map<string, { label: string; count: number; revenue: number; cogs: number; commission: number; margin: number }>();
    const ensure = (key: string, label: string) => {
      if (!groups.has(key)) groups.set(key, { label, count: 0, revenue: 0, cogs: 0, commission: 0, margin: 0 });
      return groups.get(key)!;
    };
    for (const o of orders) {
      if (!inRangeISO(o.event_date, yearStart, yearEnd)) continue;
      if (o.status === "cancelado") continue;
      const p = orderPnL(o);
      const key = o.frame_background ?? "indef";
      const label = o.frame_background && o.frame_background in FRAME_BACKGROUND_LABELS
        ? FRAME_BACKGROUND_LABELS[o.frame_background as FrameBackground]
        : "Por definir";
      const g = ensure(key, label);
      g.count += 1;
      g.revenue += p.revenue_full;
      g.cogs += p.cogs_full;
      g.commission += p.commission_full;
      g.margin += p.margin_full;
    }
    return [...groups.values()].sort((a, b) => b.margin - a.margin);
  }, [orders, yearStart, yearEnd]);

  const monthLabel = format(now, "MMMM 'de' yyyy", { locale: pt });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 dark:border-emerald-900/50 p-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-200 capitalize">
            Resumo de {monthLabel}
          </h2>
          <span className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
            Atualizado em {format(now, "dd/MM/yyyy HH:mm")}
          </span>
        </div>
      </div>

      {/* 6 KPIs principais — mês actual */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <KpiBox
          label="Receita líquida"
          value={formatEUR(month.revenueNet)}
          icon={<TrendingUp className="h-4 w-4" />}
          color="emerald"
          delta={revenueDelta}
          subLabel="Bruta"
          subValue={month.commission > 0 ? formatEUR(month.revenueGross) : undefined}
        />
        <KpiBox label="COGS" value={formatEUR(month.cogs)} icon={<Frame className="h-4 w-4" />} color="amber" />
        <KpiBox label="Comissões" value={formatEUR(month.commission)} icon={<Handshake className="h-4 w-4" />} color="violet" />
        <KpiBox label="Despesas" value={formatEUR(month.expensesTotal)} icon={<Receipt className="h-4 w-4" />} color="rose" />
        <KpiBox
          label="Lucro líquido"
          value={formatEUR(month.profit)}
          icon={<CreditCard className="h-4 w-4" />}
          color={month.profit >= 0 ? "emerald" : "rose"}
          delta={profitDelta}
        />
        <KpiBox
          label="Margem %"
          value={`${month.marginPct.toFixed(1)}%`}
          icon={<ArrowUpRight className="h-4 w-4" />}
          color={month.marginPct >= 50 ? "emerald" : month.marginPct >= 30 ? "amber" : "rose"}
        />
      </div>

      {/* 4 KPIs secundários */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiBox
          label="Encomendas no mês"
          value={String(month.orderCount)}
          icon={<Package className="h-4 w-4" />}
          color="sky"
          subLabel="Concluídas"
          subValue={month.completedCount > 0 ? String(month.completedCount) : undefined}
        />
        <KpiBox label="Ticket médio" value={formatEUR(ticketAvg)} icon={<Tags className="h-4 w-4" />} color="sky" />
        <KpiBox
          label="Quadro mais lucrativo (mês)"
          value={mostProfitableThisMonth ? formatEUR(mostProfitableThisMonth.pnl.margin_full) : "—"}
          icon={<Sparkles className="h-4 w-4" />}
          color="emerald"
          subLabel={mostProfitableThisMonth ? "Cliente" : undefined}
          subValue={mostProfitableThisMonth ? `${mostProfitableThisMonth.order.client_name} · ${mostProfitableThisMonth.pnl.margin_pct.toFixed(0)}%` : undefined}
        />
        <KpiBox
          label="Pipeline pendente"
          value={formatEUR(pendingPipeline)}
          icon={<ArrowDownRight className="h-4 w-4" />}
          color="violet"
          subLabel="Conversão vales"
          subValue={voucherConversion !== null ? `${voucherConversion.toFixed(0)}%` : undefined}
        />
      </div>

      {/* Breakdown de despesas por tipo contabilístico — mês actual */}
      <div className="rounded-xl border border-cream-200 bg-surface p-4 space-y-3">
        <h3 className="text-sm font-semibold text-cocoa-900">
          Despesas do mês por tipo
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {(Object.entries(month.expensesByType) as [keyof typeof month.expensesByType, number][]).map(([type, value]) => (
            <div
              key={type}
              className="rounded-lg border border-cocoa-200/50 bg-cream-50/50 dark:bg-cream-950/20 p-3"
            >
              <div className="text-[10px] uppercase tracking-wider text-cocoa-700 font-medium">
                {ACCOUNTING_TYPE_LABELS[type]}
              </div>
              <div className="text-lg font-semibold text-cocoa-900 tabular-nums">
                {formatEUR(value)}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-cocoa-700 italic">
          Despesas categorizadas dinamicamente a partir do tipo definido na despesa: flores/molduras/materiais → COGS variável; software/serviços/transporte/outros → Operacional; taxas → Financeira.
        </p>
      </div>

      {/* Ranking — Onde está o lucro (ano corrente) */}
      <div className="rounded-xl border border-cream-200 bg-surface p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-cocoa-900">
            Onde está o lucro — {currentYear}
          </h3>
          <p className="text-xs text-cocoa-700 italic">
            Agregação pelo orçamento e custo plenos (não proporcionais). Cancelado excluído.
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-cocoa-900 mb-2 uppercase tracking-wide">
            Por tamanho de moldura
          </h4>
          <RankingTable rows={rankingBySize} />
        </div>

        <div>
          <h4 className="text-xs font-semibold text-cocoa-900 mb-2 uppercase tracking-wide">
            Por tipo de fundo
          </h4>
          <RankingTable rows={rankingByBackground} />
        </div>
      </div>
    </div>
  );
}

function RankingTable({
  rows,
}: {
  rows: Array<{ label: string; count: number; revenue: number; cogs: number; commission: number; margin: number }>;
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-cocoa-700 italic">Sem dados neste período.</p>;
  }
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalMargin = rows.reduce((s, r) => s + r.margin, 0);
  return (
    <div className="rounded-lg overflow-hidden border border-cream-200">
      <table className="w-full text-sm">
        <thead className="bg-cream-50 text-xs uppercase tracking-wide text-cocoa-700">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Categoria</th>
            <th className="text-right px-3 py-2 font-medium w-16">Nº</th>
            <th className="text-right px-3 py-2 font-medium w-24">Receita</th>
            <th className="text-right px-3 py-2 font-medium w-24">COGS</th>
            <th className="text-right px-3 py-2 font-medium w-24">Comissão</th>
            <th className="text-right px-3 py-2 font-medium w-24">Margem €</th>
            <th className="text-right px-3 py-2 font-medium w-20">Margem %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = r.revenue > 0 ? (r.margin / r.revenue) * 100 : 0;
            return (
              <tr key={r.label} className="border-t border-cream-100">
                <td className="px-3 py-2 text-cocoa-900">{r.label}</td>
                <td className="px-3 py-2 text-right tabular-nums text-cocoa-900">{r.count}</td>
                <td className="px-3 py-2 text-right tabular-nums text-cocoa-900">{formatEUR(r.revenue)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-rose-700">{formatEUR(r.cogs)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-violet-700">{formatEUR(r.commission)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">{formatEUR(r.margin)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">{pct.toFixed(0)}%</td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-cream-300 bg-cream-50/50 font-semibold">
            <td className="px-3 py-2 text-cocoa-900">Total</td>
            <td className="px-3 py-2 text-right tabular-nums text-cocoa-900">
              {rows.reduce((s, r) => s + r.count, 0)}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-cocoa-900">{formatEUR(totalRevenue)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-rose-700">
              {formatEUR(rows.reduce((s, r) => s + r.cogs, 0))}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-violet-700">
              {formatEUR(rows.reduce((s, r) => s + r.commission, 0))}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{formatEUR(totalMargin)}</td>
            <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
              {totalRevenue > 0 ? ((totalMargin / totalRevenue) * 100).toFixed(0) : "0"}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// P&L POR ENCOMENDA
// ============================================================

type PnLSortBy = "event_date" | "client_name" | "budget" | "margin_eur" | "margin_pct" | "paid_ratio";

function PnLTab({ orders }: { orders: FaturacaoOrder[] }) {
  const now = useMemo(() => new Date(), []);
  const currentYear = getYear(now);

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    for (const o of orders) {
      if (o.event_date) {
        try { years.add(getYear(parseISO(o.event_date))); } catch {}
      }
    }
    return [...years].sort((a, b) => b - a);
  }, [orders, currentYear]);

  const [selectedYear, setSelectedYear] = useState<number | "all">(currentYear);
  const [sortBy, setSortBy] = useState<PnLSortBy>("margin_eur");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const yearStart = selectedYear === "all" ? new Date(1970, 0, 1) : startOfYear(new Date(selectedYear as number, 0, 1));
  const yearEnd = selectedYear === "all" ? new Date(2999, 11, 31) : endOfYear(new Date(selectedYear as number, 11, 31));

  const rows = useMemo(() => {
    const filtered = orders
      .filter((o) => o.status !== "cancelado")
      .filter((o) => inRangeISO(o.event_date, yearStart, yearEnd))
      .map((o) => ({ order: o, pnl: orderPnL(o) }));

    const cmp = (a: typeof filtered[0], b: typeof filtered[0]): number => {
      switch (sortBy) {
        case "event_date":
          return (a.order.event_date ?? "").localeCompare(b.order.event_date ?? "");
        case "client_name":
          return a.order.client_name.localeCompare(b.order.client_name, "pt");
        case "budget":
          return a.pnl.revenue_full - b.pnl.revenue_full;
        case "margin_eur":
          return a.pnl.margin_full - b.pnl.margin_full;
        case "margin_pct":
          return a.pnl.margin_pct - b.pnl.margin_pct;
        case "paid_ratio":
          return a.pnl.paid_ratio - b.pnl.paid_ratio;
      }
    };
    filtered.sort((a, b) => (sortDir === "asc" ? cmp(a, b) : -cmp(a, b)));
    return filtered;
  }, [orders, yearStart, yearEnd, sortBy, sortDir]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, { pnl }) => ({
        revenue: acc.revenue + pnl.revenue_full,
        cogs: acc.cogs + pnl.cogs_full,
        commission: acc.commission + pnl.commission_full,
        margin: acc.margin + pnl.margin_full,
      }),
      { revenue: 0, cogs: 0, commission: 0, margin: 0 },
    );
  }, [rows]);

  const toggleSort = (col: PnLSortBy) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const sortArrow = (col: PnLSortBy) => {
    if (sortBy !== col) return null;
    return <span className="ml-1 opacity-60">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Selector ano + info */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-cocoa-700" />
          <span className="text-sm font-medium text-cocoa-900">Ano:</span>
          <Select
            value={selectedYear === "all" ? "all" : String(selectedYear)}
            onValueChange={(v) => setSelectedYear(v === "all" ? "all" : Number(v))}
          >
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos (desde sempre)</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}{y === currentYear ? " (actual)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-cocoa-700 italic">
          {rows.length} {rows.length === 1 ? "encomenda" : "encomendas"} (cancelado excluído). Valores plenos (não proporcionais ao %pago). Clica nas colunas para ordenar.
        </p>
      </div>

      {/* Totais em destaque */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiBox label="Receita" value={formatEUR(totals.revenue)} icon={<TrendingUp className="h-4 w-4" />} color="emerald" />
        <KpiBox label="COGS" value={formatEUR(totals.cogs)} icon={<Frame className="h-4 w-4" />} color="amber" />
        <KpiBox label="Comissões" value={formatEUR(totals.commission)} icon={<Handshake className="h-4 w-4" />} color="violet" />
        <KpiBox label="Margem €" value={formatEUR(totals.margin)} icon={<CreditCard className="h-4 w-4" />} color={totals.margin >= 0 ? "emerald" : "rose"} />
        <KpiBox
          label="Margem %"
          value={totals.revenue > 0 ? `${((totals.margin / totals.revenue) * 100).toFixed(1)}%` : "—"}
          icon={<ArrowUpRight className="h-4 w-4" />}
          color="emerald"
        />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-cream-200 bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-cream-50 text-xs uppercase tracking-wide text-cocoa-700 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 font-medium">ID</th>
              <th
                className="text-left px-3 py-2 font-medium cursor-pointer hover:text-cocoa-900"
                onClick={() => toggleSort("client_name")}
              >
                Cliente {sortArrow("client_name")}
              </th>
              <th
                className="text-left px-3 py-2 font-medium cursor-pointer hover:text-cocoa-900"
                onClick={() => toggleSort("event_date")}
              >
                Data evento {sortArrow("event_date")}
              </th>
              <th className="text-left px-3 py-2 font-medium">Estado</th>
              <th
                className="text-right px-3 py-2 font-medium cursor-pointer hover:text-cocoa-900 w-24"
                onClick={() => toggleSort("budget")}
              >
                Preço {sortArrow("budget")}
              </th>
              <th className="text-right px-3 py-2 font-medium w-24">COGS</th>
              <th className="text-right px-3 py-2 font-medium w-24">Comissão</th>
              <th
                className="text-right px-3 py-2 font-medium cursor-pointer hover:text-cocoa-900 w-24"
                onClick={() => toggleSort("margin_eur")}
              >
                Margem € {sortArrow("margin_eur")}
              </th>
              <th
                className="text-right px-3 py-2 font-medium cursor-pointer hover:text-cocoa-900 w-20"
                onClick={() => toggleSort("margin_pct")}
              >
                Margem % {sortArrow("margin_pct")}
              </th>
              <th
                className="text-right px-3 py-2 font-medium cursor-pointer hover:text-cocoa-900 w-16"
                onClick={() => toggleSort("paid_ratio")}
              >
                %pago {sortArrow("paid_ratio")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-cocoa-700 italic">
                  Sem encomendas no período seleccionado.
                </td>
              </tr>
            ) : (
              rows.map(({ order: o, pnl }) => (
                <tr key={o.id} className="border-t border-cream-100 hover:bg-cream-50/40">
                  <td className="px-3 py-2 text-cocoa-700 font-mono text-[11px]">
                    {o.order_id?.slice(0, 8) ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-cocoa-900 max-w-[180px] truncate" title={o.client_name}>
                    {o.client_name || "—"}
                  </td>
                  <td className="px-3 py-2 text-cocoa-900 tabular-nums">
                    {o.event_date ? format(parseISO(o.event_date), "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="px-3 py-2 text-cocoa-700 text-xs">
                    {STATUS_LABELS[o.status]}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-cocoa-900">{formatEUR(pnl.revenue_full)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-700">{pnl.cogs_full > 0 ? formatEUR(pnl.cogs_full) : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-violet-700">{pnl.commission_full > 0 ? formatEUR(pnl.commission_full) : "—"}</td>
                  <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", pnl.margin_full >= 0 ? "text-emerald-700" : "text-rose-700")}>
                    {formatEUR(pnl.margin_full)}
                  </td>
                  <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", pnl.margin_pct >= 50 ? "text-emerald-700" : pnl.margin_pct >= 30 ? "text-amber-700" : "text-rose-700")}>
                    {pnl.margin_pct.toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-cocoa-700">
                    {(pnl.paid_ratio * 100).toFixed(0)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-cocoa-700 italic px-1">
        <strong>Margem €</strong> = Preço − COGS − Comissão (valores plenos da encomenda, independentemente do %pago). <strong>COGS</strong> a 0 = encomenda anterior à mig 034 ou sem snapshot. <strong>Comissão</strong> a 0 = sem parceiro ou estado "N/A"/"Não aceita". Para análise por período (mensal/anual), ver Painel e Faturação.
      </p>
    </div>
  );
}

// ============================================================
// CATÁLOGO (Preços + Custos + Margem teórica por SKU)
// ============================================================

function CatalogoTab({
  pricing,
  productionCosts,
  canEdit,
}: {
  pricing: PricingItem[];
  productionCosts: ProductionCostItem[];
  canEdit: boolean;
}) {
  return (
    <div className="space-y-6">
      <MargemTeoricaSection
        pricing={pricing}
        productionCosts={productionCosts}
        canEdit={canEdit}
      />
      <CustosTab items={productionCosts} canEdit={canEdit} />
    </div>
  );
}

// ============================================================
// MARGEM TEÓRICA — tabela editável (Bloco 1 quadros + Bloco 2 extras)
// ============================================================
// Substitui a antiga PrecosTab (3 subsecções) com uma única vista
// editável de preços cliente, custos derivados das 6 tabelas em baixo
// (Custos de produção), e margem calculada.
//
// Bloco 1 — 4 tamanhos × 3 fundos = 12 linhas. "Base" é partilhada
// entre as 3 linhas do mesmo tamanho (rowspan). "Supl." só aparece
// editável na linha fotografia. Custo, margem € e margem % são derivados.
//
// Bloco 2 — 2 extras autónomos (ornamento, pendente). Preço e custo
// FBR são ambos editáveis (custo guardado em pricing_items.cost_fbr).

type SizeKey = "30x40" | "40x50" | "50x70" | "20x25_mini";
type BgKey = "transparente" | "preto" | "fotografia";

interface SizeMeta {
  key: SizeKey;
  label: string;       // "Moldura 30x40", "Moldura 20x25 (mini)"
  costSize: "30x40" | "40x50" | "50x70" | "mini_20x25"; // chave nas tabelas de custos
  // O preço-base do mini está em pricing_items.extra.mini_frame; dos outros em
  // pricing_items.base_frame.<size>. Esta string identifica o sítio correcto.
  baseCategory: "base_frame" | "extra";
  baseKey: string;     // "30x40" / "40x50" / "50x70" / "mini_frame"
  // Chave do suplemento de fotografia no pricing_items.background_supplement.
  photoSuppKey: string; // "fotografia_30x40" / ... / "fotografia_mini"
}

const SIZES: SizeMeta[] = [
  { key: "30x40",      label: "Moldura 30x40 (A3)",     costSize: "30x40",      baseCategory: "base_frame", baseKey: "30x40",      photoSuppKey: "fotografia_30x40" },
  { key: "40x50",      label: "Moldura 40x50",          costSize: "40x50",      baseCategory: "base_frame", baseKey: "40x50",      photoSuppKey: "fotografia_40x50" },
  { key: "50x70",      label: "Moldura 50x70",          costSize: "50x70",      baseCategory: "base_frame", baseKey: "50x70",      photoSuppKey: "fotografia_50x70" },
  { key: "20x25_mini", label: "Moldura 20x25 (mini)",   costSize: "mini_20x25", baseCategory: "extra",      baseKey: "mini_frame", photoSuppKey: "fotografia_mini"  },
];

const BACKGROUNDS: Array<{ key: BgKey; label: string }> = [
  { key: "transparente", label: "Fundo transparente (vidro/vidro)" },
  { key: "preto",        label: "Fundo preto / branco / cor" },
  { key: "fotografia",   label: "Fundo fotografia" },
];

function MargemTeoricaSection({
  pricing,
  productionCosts,
  canEdit,
}: {
  pricing: PricingItem[];
  productionCosts: ProductionCostItem[];
  canEdit: boolean;
}) {
  // Snapshot vivo dos custos — para reusar `computeProductionCost` nos
  // quadros principais e garantir paridade exacta com o cálculo real.
  const snapshot = useMemo(
    () => ({
      captured_at: new Date().toISOString(),
      items: productionCosts
        .filter((i) => i.deleted_at === null)
        .map((i) => ({
          kind: i.kind,
          size_key: i.size_key,
          frame_type: i.frame_type,
          glass_type: i.glass_type,
          label: i.label,
          cost: i.cost,
        })),
    }),
    [productionCosts],
  );

  // Lookups por (categoria, key). Devolvem o item inteiro para podermos
  // editar via id, ou null se não existir.
  const findPricing = (category: PricingItem["category"], key: string) =>
    pricing.find(
      (p) => p.category === category && p.key === key && p.deleted_at === null,
    ) ?? null;

  const sizeBase = (s: SizeMeta) => findPricing(s.baseCategory, s.baseKey);
  const sizePhotoSupp = (s: SizeMeta) => findPricing("background_supplement", s.photoSuppKey);

  // ── Cálculo do custo de cada linha (read-only na verde) ──
  // Para 30x40/40x50/50x70 reusamos computeProductionCost para paridade.
  // Para o mini não dá (mini é add-on do main no fluxo real); calculo
  // manualmente: frame line + photo print se fotografia.
  function rowCost(size: SizeMeta, bg: BgKey): number {
    if (size.key !== "20x25_mini") {
      const bd = computeProductionCost(
        {
          frame_size: size.key as "30x40" | "40x50" | "50x70",
          frame_background: bg,
          pyramid_frame: false,
          frame_internal_type: "baixa",
          extra_small_frames: "nao",
          extra_small_frames_qty: 0,
        },
        snapshot,
      );
      return bd?.total ?? 0;
    }
    // Mini standalone — frame mini baixa + photo print mini se fotografia.
    const glass = bg === "transparente" ? "vidro_vidro" : "vidro_cartao";
    const frame = snapshot.items.find(
      (l) =>
        l.kind === "frame" &&
        l.size_key === "mini_20x25" &&
        l.frame_type === "baixa" &&
        l.glass_type === glass,
    );
    const photo = bg === "fotografia"
      ? snapshot.items.find(
          (l) => l.kind === "photo_print" && l.size_key === "mini_20x25",
        )
      : null;
    return Number(frame?.cost ?? 0) + Number(photo?.cost ?? 0);
  }

  // ── Extras autónomos (Bloco 2) — ornamento + pendente ──
  // Preço cliente vem de pricing_items. Custo deriva da soma de consumíveis
  // com size_key correspondente (mig 056 — ornament e pendant são produtos
  // vendáveis com a sua coluna na tabela de Custos de produção em baixo).
  const ornament = findPricing("extra", "christmas_ornament");
  const pendant = findPricing("extra", "necklace_pendant");
  const consumablesCostByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of productionCosts) {
      if (item.kind !== "consumable" || item.deleted_at !== null) continue;
      map.set(item.size_key, (map.get(item.size_key) ?? 0) + Number(item.cost));
    }
    return map;
  }, [productionCosts]);
  const consumablesCost = (productKey: string) =>
    consumablesCostByProduct.get(productKey) ?? 0;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 dark:border-emerald-900/50 p-4 sm:p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-emerald-200/60 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
          <TrendingUp className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            Margem teórica — preços, custos e lucro por quadro
          </h2>
          <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">
            Edita <strong>Base</strong> e <strong>Supl.</strong> (fotografia). <strong>Custo</strong> e <strong>Margem</strong> calculam-se a partir das tabelas em baixo. Combinações menos comuns (caixa, pirâmide, vidro/vidro) vivem só nessas tabelas.
            {!canEdit && <span className="block mt-1 italic">Modo leitura — só administradores podem editar.</span>}
          </p>
        </div>
      </div>

      {/* Bloco 1 — Quadros */}
      <div className="rounded-xl bg-surface overflow-hidden border border-emerald-200/60 dark:border-emerald-900/40">
        <table className="w-full text-sm">
          <thead className="bg-emerald-100/60 dark:bg-emerald-900/30 text-xs uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Combinação</th>
              <th className="text-right px-3 py-2 font-medium w-28">Base (€)</th>
              <th className="text-right px-3 py-2 font-medium w-24">+€ Supl.</th>
              <th className="text-right px-3 py-2 font-medium w-24">Preço cli.</th>
              <th className="text-right px-3 py-2 font-medium w-24">Custo</th>
              <th className="text-right px-3 py-2 font-medium w-24">Margem €</th>
              <th className="text-right px-3 py-2 font-medium w-20">Margem %</th>
            </tr>
          </thead>
          <tbody>
            {SIZES.map((size) => {
              const baseItem = sizeBase(size);
              const supplItem = sizePhotoSupp(size);
              const basePrice = Number(baseItem?.price ?? 0);
              return (
                <React.Fragment key={size.key}>
                  <tr className="bg-emerald-50/60 dark:bg-emerald-950/20">
                    <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      {size.label}
                    </td>
                  </tr>
                  {BACKGROUNDS.map((bg, idx) => {
                    const isPhoto = bg.key === "fotografia";
                    const suppPrice = isPhoto ? Number(supplItem?.price ?? 0) : 0;
                    const clientPrice = basePrice + suppPrice;
                    const cost = rowCost(size, bg.key);
                    const margin = clientPrice - cost;
                    const marginPct = clientPrice > 0 ? (margin / clientPrice) * 100 : 0;
                    return (
                      <tr key={`${size.key}-${bg.key}`} className="border-t border-emerald-100 dark:border-emerald-900/30">
                        <td className="px-3 py-2 text-cocoa-900">{bg.label}</td>
                        {idx === 0 ? (
                          <td
                            rowSpan={3}
                            className="px-2 py-2 text-right align-middle border-l border-emerald-100/60"
                          >
                            <EditableEuro
                              item={baseItem}
                              field="price"
                              canEdit={canEdit}
                              align="right"
                            />
                          </td>
                        ) : null}
                        <td className="px-2 py-2 text-right">
                          {isPhoto ? (
                            <EditableEuro
                              item={supplItem}
                              field="price"
                              canEdit={canEdit}
                              align="right"
                            />
                          ) : (
                            <span className="text-cocoa-500">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-cocoa-900 font-medium">
                          {formatEUR(clientPrice)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-700">
                          {formatEUR(cost)}
                        </td>
                        <td className={cn(
                          "px-3 py-2 text-right tabular-nums font-semibold",
                          margin >= 0 ? "text-emerald-700" : "text-rose-700",
                        )}>
                          {formatEUR(margin)}
                        </td>
                        <td className={cn(
                          "px-3 py-2 text-right tabular-nums font-semibold",
                          marginPct >= 50 ? "text-emerald-700" : marginPct >= 30 ? "text-amber-700" : "text-rose-700",
                        )}>
                          {clientPrice > 0 ? `${marginPct.toFixed(0)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bloco 2 — Extras (ornamento + pendente) */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
          Extras (vendidos à parte)
        </h3>
        <div className="rounded-xl bg-surface overflow-hidden border border-emerald-200/60 dark:border-emerald-900/40">
          <table className="w-full text-sm">
            <thead className="bg-emerald-100/60 dark:bg-emerald-900/30 text-xs uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Item</th>
                <th className="text-right px-3 py-2 font-medium w-28">Preço cli. (€)</th>
                <th className="text-right px-3 py-2 font-medium w-24">Custo</th>
                <th className="text-right px-3 py-2 font-medium w-24">Margem €</th>
                <th className="text-right px-3 py-2 font-medium w-20">Margem %</th>
              </tr>
            </thead>
            <tbody>
              {[
                { item: ornament, productKey: "christmas_ornament" },
                { item: pendant,  productKey: "necklace_pendant"   },
              ].map(({ item, productKey }) => {
                if (!item) return null;
                const price = Number(item.price ?? 0);
                const cost = consumablesCost(productKey);
                const margin = price - cost;
                const marginPct = price > 0 ? (margin / price) * 100 : 0;
                return (
                  <tr key={item.id} className="border-t border-emerald-100 dark:border-emerald-900/30">
                    <td className="px-3 py-2 text-cocoa-900">{item.label}</td>
                    <td className="px-2 py-2 text-right">
                      <EditableEuro item={item} field="price" canEdit={canEdit} align="right" />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-700">
                      {formatEUR(cost)}
                    </td>
                    <td className={cn(
                      "px-3 py-2 text-right tabular-nums font-semibold",
                      margin >= 0 ? "text-emerald-700" : "text-rose-700",
                    )}>
                      {formatEUR(margin)}
                    </td>
                    <td className={cn(
                      "px-3 py-2 text-right tabular-nums font-semibold",
                      marginPct >= 50 ? "text-emerald-700" : marginPct >= 30 ? "text-amber-700" : "text-rose-700",
                    )}>
                      {price > 0 ? `${marginPct.toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-emerald-800/70 italic">
          <strong>Custo</strong> deriva dos consumíveis das colunas <em>Ornamento</em> e <em>Pendente</em> na tabela "Outros custos recorrentes" em baixo.
        </p>
      </div>
    </div>
  );
}

// Célula editável de valor em €. Persiste em onBlur via updatePricingItemAction.
// Inputs vazios viram 0. Usa o padrão "store info from previous renders" para
// sincronizar o draft local quando o item muda na BD (sem useEffect+setState).
function EditableEuro({
  item,
  field,
  canEdit,
  align = "right",
}: {
  item: PricingItem | null;
  field: "price";
  canEdit: boolean;
  align?: "left" | "right";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const current = item ? Number(item[field] ?? 0) : 0;
  const [draft, setDraft] = useState(formatDraft(current));
  const [lastItemId, setLastItemId] = useState(item?.id ?? null);
  const [lastValue, setLastValue] = useState(current);
  if (item && (item.id !== lastItemId || current !== lastValue)) {
    setLastItemId(item.id);
    setLastValue(current);
    setDraft(formatDraft(current));
  }

  if (!item) {
    return <span className="text-cocoa-500 italic text-xs">item em falta</span>;
  }

  function save(raw: string) {
    const next = raw.trim() === "" ? 0 : Number(raw.replace(",", "."));
    if (Number.isNaN(next) || next < 0) {
      toast.error("Valor inválido");
      setDraft(formatDraft(current));
      return;
    }
    if (next === current) {
      setDraft(formatDraft(next)); // normaliza o display
      return;
    }
    setSaving(true);
    startTransition(async () => {
      try {
        await updatePricingItemAction(item!.id, { [field]: next });
        toast.success(`${item!.label}: ${formatEUR(next)}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao guardar");
        setDraft(formatDraft(current));
      } finally {
        setSaving(false);
      }
    });
  }

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => save(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      disabled={!canEdit || saving}
      inputMode="decimal"
      placeholder="0"
      className={cn(
        "h-8 w-24 text-sm font-medium tabular-nums",
        align === "right" && "text-right",
      )}
    />
  );
}

function formatDraft(n: number): string {
  if (!n || n === 0) return "0";
  // Formato europeu sem unidade (vírgula decimal). Aparas zeros redundantes.
  const fixed = n.toFixed(2);
  return fixed.replace(/\.?0+$/, "").replace(".", ",");
}

// ============================================================
// DESPESAS — Únicas (default) + Subscrições
// ============================================================

type DespesasSubTab = "unicas" | "subscricoes";

// Fornecedor é opcional e pode ser texto OU link. Auto-detecta URL
// (http(s):// ou www.) e renderiza clicável. Caso contrário texto puro.
function renderSupplier(s: string | null | undefined): React.ReactNode {
  const v = (s ?? "").trim();
  if (!v) return <span className="text-cocoa-500">—</span>;
  const isUrl = /^(https?:\/\/|www\.)/i.test(v);
  if (!isUrl) return <span className="text-cocoa-700">{v}</span>;
  const href = v.startsWith("http") ? v : `https://${v}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 hover:underline underline-offset-2 max-w-[220px] truncate"
      title={v}
    >
      <span className="truncate">{v.replace(/^https?:\/\//i, "").replace(/\/$/, "")}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
    </a>
  );
}

function DespesasTab({
  expenses,
  canEdit,
}: {
  expenses: Expense[];
  canEdit: boolean;
}) {
  const [sub, setSub] = useState<DespesasSubTab>("unicas");

  // Separa as despesas em duas listas (excluí soft-deleted no servidor).
  const unicas    = useMemo(() => expenses.filter((e) => !e.is_recurring), [expenses]);
  const subscript = useMemo(() => expenses.filter((e) =>  e.is_recurring), [expenses]);

  // KPIs globais — visíveis em ambos os modos.
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const unicasMonth = unicas
    .filter((e) => {
      const d = parseISO(e.expense_date);
      return d >= monthStart && d <= monthEnd;
    })
    .reduce((s, e) => s + Number(e.amount), 0);

  // Para subscrições, conta as activas e soma o custo mensal equivalente.
  const activeSubs = subscript.filter((e) => isSubscriptionActive(e, now));
  const monthlyRecurring = activeSubs.reduce((s, e) => s + monthlyEquivalent(e), 0);
  const totalMonth = unicasMonth + monthlyRecurring;

  // Total desde sempre = todas as despesas únicas + acumulado estimado
  // de cada subscrição desde o seu início até hoje (ou até ao seu fim
  // se já terminou).
  const unicasEver = unicas.reduce((s, e) => s + Number(e.amount), 0);
  const subsEver = subscript.reduce((s, e) => s + subscriptionTotalToDate(e, now), 0);
  const totalEver = unicasEver + subsEver;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiBox
          label="Despesas únicas — este mês"
          value={formatEUR(unicasMonth)}
          icon={<Receipt className="h-4 w-4" />}
          color="rose"
        />
        <KpiBox
          label={`Subscrições activas (${activeSubs.length})`}
          value={`${formatEUR(monthlyRecurring)} / mês`}
          icon={<RotateCw className="h-4 w-4" />}
          color="violet"
        />
        <KpiBox
          label="Custo total estimado — este mês"
          value={formatEUR(totalMonth)}
          icon={<TrendingUp className="h-4 w-4" />}
          color="amber"
        />
        <KpiBox
          label="Total desde sempre"
          value={formatEUR(totalEver)}
          icon={<Euro className="h-4 w-4" />}
          color="emerald"
        />
      </div>

      {/* Sub-tabs Únicas / Subscrições */}
      <div className="inline-flex rounded-xl border border-cream-200 bg-surface p-1 gap-1">
        <SubTabButton
          active={sub === "unicas"}
          onClick={() => setSub("unicas")}
          icon={<Receipt className="h-4 w-4" />}
          label="Despesas únicas"
          count={unicas.length}
        />
        <SubTabButton
          active={sub === "subscricoes"}
          onClick={() => setSub("subscricoes")}
          icon={<RotateCw className="h-4 w-4" />}
          label="Subscrições"
          count={subscript.length}
        />
      </div>

      {sub === "unicas" && (
        <DespesasUnicas expenses={unicas} canEdit={canEdit} />
      )}
      {sub === "subscricoes" && (
        <DespesasSubscricoes expenses={subscript} canEdit={canEdit} />
      )}
    </div>
  );
}

function SubTabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
        active
          ? "bg-cocoa-900 text-surface dark:bg-[#E8D5B5] dark:text-[#1B1611]"
          : "text-cocoa-700 hover:bg-cream-100 hover:text-cocoa-900",
      )}
    >
      {icon}
      {label}
      <span
        className={cn(
          "text-[10px] px-1.5 py-0.5 rounded-full font-semibold tabular-nums",
          active
            ? "bg-surface/15 dark:bg-[#1B1611]/15"
            : "bg-cream-200 text-cocoa-700",
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ── Despesas únicas ─────────────────────────────────────────

function DespesasUnicas({
  expenses,
  canEdit,
}: {
  expenses: Expense[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "todas">("todas");
  const [search, setSearch] = useState("");
  const [newExpense, setNewExpense] = useState({
    expense_date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    category: "materiais" as ExpenseCategory, // default Maria: materiais
    amount: "",
    supplier: "",
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (categoryFilter !== "todas" && e.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        (e.description ?? "").toLowerCase().includes(q) ||
        (e.supplier ?? "").toLowerCase().includes(q) ||
        (e.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [expenses, search, categoryFilter]);

  function handleCreate() {
    const amount = parseFloat(newExpense.amount.replace(",", "."));
    if (!newExpense.description.trim() || !amount || amount <= 0) {
      toast.error("Preenche a descrição e um valor válido.");
      return;
    }
    startTransition(async () => {
      try {
        await createExpenseAction({
          expense_date: newExpense.expense_date,
          description: newExpense.description.trim(),
          category: newExpense.category,
          amount,
          supplier: newExpense.supplier.trim() || null,
          is_recurring: false,
        });
        toast.success("Despesa registada.");
        setCreating(false);
        setNewExpense({
          expense_date: format(new Date(), "yyyy-MM-dd"),
          description: "",
          category: "materiais",
          amount: "",
          supplier: "",
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao registar.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500" />
          <Input
            placeholder="Pesquisar descrição ou fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as ExpenseCategory | "todas")}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {EXPENSE_CATEGORY_ORDER.map((c) => (
              <SelectItem key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canEdit && (
          <Button
            onClick={() => setCreating((v) => !v)}
            className="bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg h-9 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova despesa
          </Button>
        )}
      </div>

      {creating && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-rose-900">Registar nova despesa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_180px_120px] gap-2">
            <Input
              type="date"
              value={newExpense.expense_date}
              onChange={(e) => setNewExpense((p) => ({ ...p, expense_date: e.target.value }))}
            />
            <Input
              placeholder="Descrição (ex.: Caixas de cartão, almoço com cliente…)"
              value={newExpense.description}
              onChange={(e) => setNewExpense((p) => ({ ...p, description: e.target.value }))}
              autoFocus
            />
            <Select value={newExpense.category} onValueChange={(v) => setNewExpense((p) => ({ ...p, category: v as ExpenseCategory }))}>
              <SelectTrigger>
                <SelectValue labels={EXPENSE_CATEGORY_LABELS} />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORY_ORDER.map((c) => (
                  <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-cocoa-700">€</span>
              <Input
                type="number"
                step="0.01"
                placeholder="0,00"
                className="pl-6"
                value={newExpense.amount}
                onChange={(e) => setNewExpense((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
          </div>
          <Input
            placeholder="Fornecedor (opcional) — texto ou link (ex.: Continente, https://amazon.es/…)"
            value={newExpense.supplier}
            onChange={(e) => setNewExpense((p) => ({ ...p, supplier: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button onClick={handleCreate} className="bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg">Registar</Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
          <p className="text-xs text-rose-800/70 italic">
            Podes anexar a factura depois de guardar — botão no fim da linha.
          </p>
        </div>
      )}

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cream-200 bg-surface p-12 text-center">
          <Receipt className="h-12 w-12 mx-auto text-rose-200 mb-3" />
          <p className="text-sm text-cocoa-700">
            {expenses.length === 0
              ? "Ainda não há despesas únicas registadas."
              : "Nenhuma despesa corresponde aos filtros."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-cream-200 bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px] xl:min-w-[920px]">
              <thead className="bg-cream-50">
                <tr className="text-left text-xs uppercase tracking-wide text-cocoa-700">
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Descrição</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium hidden xl:table-cell">Fornecedor</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium">Pagamento</th>
                  <th className="px-3 py-2 font-medium">Factura</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <ExpenseRow key={e.id} expense={e} canEdit={canEdit} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Subscrições ─────────────────────────────────────────────

function DespesasSubscricoes({
  expenses,
  canEdit,
}: {
  expenses: Expense[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const today = new Date();
  const [newSub, setNewSub] = useState({
    description: "",
    category: "software" as ExpenseCategory,
    amount: "",
    supplier: "",
    recurrence_period: "monthly" as ExpenseRecurrencePeriod,
    recurrence_start_date: format(today, "yyyy-MM-dd"),
    recurrence_end_date: "",
  });

  function handleCreate() {
    const amount = parseFloat(newSub.amount.replace(",", "."));
    if (!newSub.description.trim() || !amount || amount <= 0) {
      toast.error("Preenche a descrição e um valor válido.");
      return;
    }
    if (!newSub.recurrence_start_date) {
      toast.error("Indica a data de início da subscrição.");
      return;
    }
    if (
      newSub.recurrence_period === "custom" &&
      newSub.recurrence_end_date &&
      newSub.recurrence_end_date < newSub.recurrence_start_date
    ) {
      toast.error("A data de fim tem que ser depois do início.");
      return;
    }
    startTransition(async () => {
      try {
        await createExpenseAction({
          // expense_date guarda a data de referência (1º pagamento) para
          // a tabela aparecer no relatório do mês de início.
          expense_date: newSub.recurrence_start_date,
          description: newSub.description.trim(),
          category: newSub.category,
          amount,
          supplier: newSub.supplier.trim() || null,
          is_recurring: true,
          recurrence_period: newSub.recurrence_period,
          recurrence_start_date: newSub.recurrence_start_date,
          recurrence_end_date: newSub.recurrence_end_date || null,
        });
        toast.success("Subscrição registada.");
        setCreating(false);
        setNewSub({
          description: "",
          category: "software",
          amount: "",
          supplier: "",
          recurrence_period: "monthly",
          recurrence_start_date: format(new Date(), "yyyy-MM-dd"),
          recurrence_end_date: "",
        });
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao registar.");
      }
    });
  }

  // Ordena: activas primeiro (por start desc), depois terminadas.
  const ordered = useMemo(() => {
    const now = new Date();
    return [...expenses].sort((a, b) => {
      const aActive = isSubscriptionActive(a, now) ? 1 : 0;
      const bActive = isSubscriptionActive(b, now) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const aStart = a.recurrence_start_date ?? a.expense_date;
      const bStart = b.recurrence_start_date ?? b.expense_date;
      return bStart.localeCompare(aStart);
    });
  }, [expenses]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-cocoa-700">
          Subscrições mensais, anuais ou de intervalo específico (start &amp; end).
          O custo total mensal estimado aparece nos KPIs em cima.
        </p>
        {canEdit && (
          <Button
            onClick={() => setCreating((v) => !v)}
            className="bg-violet-600 hover:bg-violet-700 text-white h-9 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova subscrição
          </Button>
        )}
      </div>

      {creating && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/60 dark:bg-violet-950/20 dark:border-violet-900/50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
            Registar nova subscrição
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-cocoa-700">Descrição *</label>
              <Input
                placeholder="Ex.: Vercel Pro, Adobe CC, Spotify Family…"
                value={newSub.description}
                onChange={(e) => setNewSub((p) => ({ ...p, description: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-cocoa-700">Categoria</label>
              <Select value={newSub.category} onValueChange={(v) => setNewSub((p) => ({ ...p, category: v as ExpenseCategory }))}>
                <SelectTrigger>
                  <SelectValue labels={EXPENSE_CATEGORY_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[180px_180px_180px_120px] gap-2">
            <div>
              <label className="text-xs text-cocoa-700">Periodicidade</label>
              <Select
                value={newSub.recurrence_period}
                onValueChange={(v) => setNewSub((p) => ({ ...p, recurrence_period: v as ExpenseRecurrencePeriod }))}
              >
                <SelectTrigger>
                  <SelectValue labels={EXPENSE_RECURRENCE_PERIOD_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EXPENSE_RECURRENCE_PERIOD_LABELS) as ExpenseRecurrencePeriod[]).map((p) => (
                    <SelectItem key={p} value={p}>{EXPENSE_RECURRENCE_PERIOD_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-cocoa-700">Início *</label>
              <Input
                type="date"
                value={newSub.recurrence_start_date}
                onChange={(e) => setNewSub((p) => ({ ...p, recurrence_start_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-cocoa-700">
                Fim {newSub.recurrence_period === "custom" ? "*" : "(opcional)"}
              </label>
              <Input
                type="date"
                value={newSub.recurrence_end_date}
                onChange={(e) => setNewSub((p) => ({ ...p, recurrence_end_date: e.target.value }))}
                placeholder="—"
              />
            </div>
            <div>
              <label className="text-xs text-cocoa-700">
                {newSub.recurrence_period === "monthly" && "Valor mensal"}
                {newSub.recurrence_period === "yearly" && "Valor anual"}
                {newSub.recurrence_period === "custom" && "Valor total"}
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-cocoa-700">€</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  className="pl-6"
                  value={newSub.amount}
                  onChange={(e) => setNewSub((p) => ({ ...p, amount: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <Input
            placeholder="Fornecedor (opcional) — texto ou link (ex.: Vercel, https://vercel.com/account)"
            value={newSub.supplier}
            onChange={(e) => setNewSub((p) => ({ ...p, supplier: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button onClick={handleCreate} className="bg-violet-600 hover:bg-violet-700 text-white">Registar</Button>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
          <p className="text-xs text-violet-800/70 italic">
            <strong>Mensal:</strong> valor cobrado em cada mês.{" "}
            <strong>Anual:</strong> valor anual, dividido por 12 para o custo mensal estimado.{" "}
            <strong>Intervalo específico:</strong> valor <em>total</em> pago pelo intervalo (ex.: 41,70 € por 14 meses = 2,98 €/mês).
          </p>
        </div>
      )}

      {ordered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-cream-200 bg-surface p-12 text-center">
          <RotateCw className="h-12 w-12 mx-auto text-violet-200 mb-3" />
          <p className="text-sm text-cocoa-700">
            Ainda não há subscrições registadas.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-cream-200 bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[780px] xl:min-w-[960px]">
              <thead className="bg-cream-50">
                <tr className="text-left text-xs uppercase tracking-wide text-cocoa-700">
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Descrição</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium">Periodicidade</th>
                  <th className="px-3 py-2 font-medium hidden xl:table-cell">Início → Fim</th>
                  <th className="px-3 py-2 font-medium text-right">Valor</th>
                  <th className="px-3 py-2 font-medium text-right">≈ por mês</th>
                  <th className="px-3 py-2 font-medium">Factura</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((e) => (
                  <SubscriptionRow key={e.id} expense={e} canEdit={canEdit} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ExpenseRow({ expense, canEdit }: { expense: Expense; canEdit: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function handleField<K extends keyof Expense>(key: K, value: Expense[K]) {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        await updateExpenseAction(expense.id, { [key]: value } as Partial<Expense>);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao guardar.");
      }
    });
  }

  function handleArchive() {
    if (!confirm("Arquivar esta despesa?")) return;
    startTransition(async () => {
      try {
        await archiveExpenseAction(expense.id);
        toast.success("Despesa arquivada.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao arquivar.");
      }
    });
  }

  return (
    <tr className="border-t border-cream-100 hover:bg-cream-50/60">
      <td className="px-3 py-2 text-cocoa-900 whitespace-nowrap">
        {format(parseISO(expense.expense_date), "dd/MM/yyyy")}
      </td>
      <td className="px-3 py-2 text-cocoa-900 font-medium max-w-[320px]">
        <div className="truncate" title={expense.description ?? expense.supplier ?? ""}>
          {expense.description ?? <span className="text-cocoa-500 italic">(sem descrição)</span>}
        </div>
        {/* Em ecrãs estreitos o fornecedor não tem coluna própria — mostramo-lo
            por baixo da descrição para não se perder. */}
        <div className="xl:hidden text-xs mt-0.5">
          {renderSupplier(expense.supplier)}
        </div>
      </td>
      <td className="px-3 py-2">
        <span className={cn(
          "inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border",
          EXPENSE_CATEGORY_COLORS[expense.category]
        )}>
          {EXPENSE_CATEGORY_LABELS[expense.category]}
        </span>
      </td>
      <td className="px-3 py-2 text-xs hidden xl:table-cell max-w-[240px]">
        {renderSupplier(expense.supplier)}
      </td>
      <td className="px-3 py-2 text-right font-semibold text-rose-700 whitespace-nowrap">
        {formatEUR(Number(expense.amount))}
      </td>
      <td className="px-3 py-2">
        {canEdit ? (
          <Select
            value={expense.payment_method ?? ""}
            onValueChange={(v) => handleField("payment_method", (v || null) as ExpensePaymentMethod | null)}
          >
            <SelectTrigger className="h-7 text-xs w-32">
              <SelectValue placeholder="—" labels={EXPENSE_PAYMENT_METHOD_LABELS} />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(EXPENSE_PAYMENT_METHOD_LABELS) as ExpensePaymentMethod[]).map((m) => (
                <SelectItem key={m} value={m}>{EXPENSE_PAYMENT_METHOD_LABELS[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-cocoa-700">
            {expense.payment_method ? EXPENSE_PAYMENT_METHOD_LABELS[expense.payment_method] : "—"}
          </span>
        )}
      </td>
      <td className="px-3 py-2">
        <InvoiceCell expense={expense} canEdit={canEdit} />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {canEdit && (
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-cocoa-500 hover:text-cocoa-900 transition-colors"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleArchive}
              className="text-cocoa-500 hover:text-rose-600 transition-colors"
              title="Arquivar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {editing && (
          <EditExpenseDialog
            expense={expense}
            open={editing}
            onOpenChange={setEditing}
          />
        )}
      </td>
    </tr>
  );
}

// ── Dialog de edição (cobre despesas únicas e subscrições) ──

function EditExpenseDialog({
  expense,
  open,
  onOpenChange,
}: {
  expense: Expense;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const isSub = expense.is_recurring;

  const [draft, setDraft] = useState({
    expense_date: expense.expense_date,
    description: expense.description ?? "",
    category: expense.category,
    amount: String(expense.amount).replace(".", ","),
    supplier: expense.supplier ?? "",
    payment_method: expense.payment_method ?? "",
    notes: expense.notes ?? "",
    recurrence_period: (expense.recurrence_period ?? "monthly") as ExpenseRecurrencePeriod,
    recurrence_start_date: expense.recurrence_start_date ?? expense.expense_date,
    recurrence_end_date: expense.recurrence_end_date ?? "",
  });

  function handleSave() {
    const amount = parseFloat(draft.amount.replace(",", "."));
    if (!draft.description.trim()) {
      toast.error("A descrição é obrigatória.");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    if (isSub && !draft.recurrence_start_date) {
      toast.error("Indica a data de início da subscrição.");
      return;
    }
    if (
      isSub &&
      draft.recurrence_period === "custom" &&
      draft.recurrence_end_date &&
      draft.recurrence_end_date < draft.recurrence_start_date
    ) {
      toast.error("A data de fim tem que ser depois do início.");
      return;
    }

    const patch: Record<string, unknown> = {
      description: draft.description.trim(),
      category: draft.category,
      amount,
      supplier: draft.supplier.trim() || null,
      notes: draft.notes.trim() || null,
      payment_method: (draft.payment_method || null) as ExpensePaymentMethod | null,
    };
    if (isSub) {
      patch.recurrence_period = draft.recurrence_period;
      patch.recurrence_start_date = draft.recurrence_start_date;
      patch.recurrence_end_date = draft.recurrence_end_date || null;
      patch.expense_date = draft.recurrence_start_date;
    } else {
      patch.expense_date = draft.expense_date;
    }

    startTransition(async () => {
      try {
        await updateExpenseAction(expense.id, patch as Partial<Expense>);
        toast.success(isSub ? "Subscrição actualizada." : "Despesa actualizada.");
        onOpenChange(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao guardar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isSub ? "Editar subscrição" : "Editar despesa"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Input
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select
                value={draft.category}
                onValueChange={(v) => setDraft({ ...draft, category: v as ExpenseCategory })}
              >
                <SelectTrigger>
                  <SelectValue labels={EXPENSE_CATEGORY_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORY_ORDER.map((c) => (
                    <SelectItem key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {isSub
                  ? draft.recurrence_period === "monthly"
                    ? "Valor mensal"
                    : draft.recurrence_period === "yearly"
                      ? "Valor anual"
                      : "Valor total"
                  : "Valor"}
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-cocoa-700">€</span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-6"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                />
              </div>
            </div>
          </div>

          {isSub ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Periodicidade</Label>
                <Select
                  value={draft.recurrence_period}
                  onValueChange={(v) => setDraft({ ...draft, recurrence_period: v as ExpenseRecurrencePeriod })}
                >
                  <SelectTrigger>
                    <SelectValue labels={EXPENSE_RECURRENCE_PERIOD_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EXPENSE_RECURRENCE_PERIOD_LABELS) as ExpenseRecurrencePeriod[]).map((p) => (
                      <SelectItem key={p} value={p}>{EXPENSE_RECURRENCE_PERIOD_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Início</Label>
                <Input
                  type="date"
                  value={draft.recurrence_start_date}
                  onChange={(e) => setDraft({ ...draft, recurrence_start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Fim {draft.recurrence_period === "custom" ? "(obrigatório)" : "(opcional)"}
                </Label>
                <Input
                  type="date"
                  value={draft.recurrence_end_date}
                  onChange={(e) => setDraft({ ...draft, recurrence_end_date: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={draft.expense_date}
                onChange={(e) => setDraft({ ...draft, expense_date: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Fornecedor (opcional, texto ou link)</Label>
            <Input
              value={draft.supplier}
              onChange={(e) => setDraft({ ...draft, supplier: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Método de pagamento</Label>
            <Select
              value={draft.payment_method || "__none__"}
              onValueChange={(v) => setDraft({ ...draft, payment_method: !v || v === "__none__" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue labels={EXPENSE_PAYMENT_METHOD_LABELS} placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">—</SelectItem>
                {(Object.keys(EXPENSE_PAYMENT_METHOD_LABELS) as ExpensePaymentMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>{EXPENSE_PAYMENT_METHOD_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notas (opcional)</Label>
            <Textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg">
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionRow({ expense, canEdit }: { expense: Expense; canEdit: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  const active = isSubscriptionActive(expense, new Date());
  const monthly = monthlyEquivalent(expense);

  function handleArchive() {
    if (!confirm("Arquivar esta subscrição?")) return;
    startTransition(async () => {
      try {
        await archiveExpenseAction(expense.id);
        toast.success("Subscrição arquivada.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao arquivar.");
      }
    });
  }

  const startStr = expense.recurrence_start_date
    ? format(parseISO(expense.recurrence_start_date), "dd/MM/yyyy")
    : "—";
  const endStr = expense.recurrence_end_date
    ? format(parseISO(expense.recurrence_end_date), "dd/MM/yyyy")
    : "∞";

  return (
    <tr className={cn("border-t border-cream-100 hover:bg-cream-50/60", !active && "opacity-60")}>
      <td className="px-3 py-2 whitespace-nowrap">
        <span className={cn(
          "inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border",
          active
            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
            : "bg-slate-100 text-slate-700 border-slate-300",
        )}>
          {active ? "Activa" : "Terminada"}
        </span>
      </td>
      <td className="px-3 py-2 text-cocoa-900 font-medium max-w-[260px]">
        <div className="truncate" title={expense.description ?? expense.supplier ?? ""}>
          {expense.description ?? <span className="text-cocoa-500 italic">(sem descrição)</span>}
        </div>
        {expense.supplier && (
          <div className="text-xs mt-0.5">{renderSupplier(expense.supplier)}</div>
        )}
      </td>
      <td className="px-3 py-2">
        <span className={cn(
          "inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border",
          EXPENSE_CATEGORY_COLORS[expense.category]
        )}>
          {EXPENSE_CATEGORY_LABELS[expense.category]}
        </span>
      </td>
      <td className="px-3 py-2 text-cocoa-700 text-xs">
        {expense.recurrence_period
          ? EXPENSE_RECURRENCE_PERIOD_LABELS[expense.recurrence_period]
          : "—"}
      </td>
      <td className="px-3 py-2 text-xs text-cocoa-700 whitespace-nowrap hidden xl:table-cell">
        <CalendarIcon className="h-3 w-3 inline -mt-0.5 mr-1 text-cocoa-500" />
        {startStr} → {endStr}
      </td>
      <td className="px-3 py-2 text-right font-semibold text-rose-700 whitespace-nowrap">
        {formatEUR(Number(expense.amount))}
      </td>
      <td className="px-3 py-2 text-right text-cocoa-900 whitespace-nowrap tabular-nums">
        {formatEUR(monthly)}
      </td>
      <td className="px-3 py-2">
        <InvoiceCell expense={expense} canEdit={canEdit} />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        {canEdit && (
          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="text-cocoa-500 hover:text-cocoa-900 transition-colors"
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleArchive}
              className="text-cocoa-500 hover:text-rose-600 transition-colors"
              title="Arquivar"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        {editing && (
          <EditExpenseDialog
            expense={expense}
            open={editing}
            onOpenChange={setEditing}
          />
        )}
      </td>
    </tr>
  );
}

// ── Anexo de factura (upload para Drive) ────────────────────

function InvoiceCell({ expense, canEdit }: { expense: Expense; canEdit: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Ficheiro demasiado grande (limite 25 MB).");
      return;
    }
    setUploading(true);
    const fd = new FormData();
    fd.set("expense_id", expense.id);
    fd.set("file", file);
    startTransition(async () => {
      try {
        await uploadExpenseInvoiceAction(fd);
        toast.success("Factura anexada ao Drive.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao anexar.");
      } finally {
        setUploading(false);
      }
    });
  }

  if (expense.invoice_url) {
    return (
      <div className="inline-flex items-center gap-1">
        <a
          href={expense.invoice_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
          title="Abrir factura no Drive"
        >
          <Paperclip className="h-3.5 w-3.5" />
          Ver
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>
        {canEdit && (
          <label className="text-cocoa-500 hover:text-cocoa-900 cursor-pointer ml-1" title="Substituir">
            <input
              type="file"
              className="hidden"
              accept="application/pdf,image/*"
              onChange={(e) => handleFile(e.target.files?.[0])}
              disabled={uploading}
            />
            <Upload className="h-3.5 w-3.5" />
          </label>
        )}
      </div>
    );
  }

  if (!canEdit) {
    return <span className="text-xs text-cocoa-500 italic">—</span>;
  }

  return (
    <label className={cn(
      "inline-flex items-center gap-1 text-xs text-cocoa-700 hover:text-cocoa-900 cursor-pointer",
      uploading && "opacity-50 pointer-events-none",
    )} title="Carregar factura para o Drive">
      <input
        type="file"
        className="hidden"
        accept="application/pdf,image/*"
        onChange={(e) => handleFile(e.target.files?.[0])}
        disabled={uploading}
      />
      <Upload className="h-3.5 w-3.5" />
      {uploading ? "A enviar…" : "Anexar"}
    </label>
  );
}

// ============================================================
// FATURAÇÃO
// ============================================================

type FaturacaoOrder = Pick<import("@/types/database").Order, "id" | "order_id" | "client_name" | "created_at" | "event_date" | "status" | "payment_status" | "budget" | "frame_delivery_date" | "frame_size" | "frame_background" | "pyramid_frame" | "frame_internal_type" | "extra_small_frames" | "extra_small_frames_qty" | "production_cost_snapshot" | "partner_commission" | "partner_commission_status">;
type FaturacaoVoucher = Pick<import("@/types/voucher").Voucher, "id" | "code" | "created_at" | "amount" | "payment_status" | "usage_status">;

function FaturacaoTab({
  orders,
  vouchers,
  expenses,
}: {
  orders: FaturacaoOrder[];
  vouchers: FaturacaoVoucher[];
  expenses: Expense[];
}) {
  // Receita = orders proporcional ao % pago + vales pagos não convertidos (evitar dupla contagem)
  const revenueFromOrder = (o: FaturacaoOrder): number => {
    if (!o.budget) return 0;
    return o.budget * paidRatioOf(o.payment_status);
  };
  const revenueFromVoucher = (v: FaturacaoVoucher): number => {
    if (v.payment_status !== "100_pago") return 0;
    if (v.usage_status === "preservacao_agendada") return 0; // evita dupla contagem com a encomenda
    return Number(v.amount);
  };
  // COGS proporcional ao % pago — mesma lógica que a receita para manter a
  // margem comparável por período. Implementação em lib/finance.ts.
  const cogsFromOrder = (o: FaturacaoOrder): number => cogsRecognizedFromOrder(o);

  const now = new Date();
  const currentYear = getYear(now);

  // Anos disponíveis: encomendas pela data do evento; vales pela data de criação;
  // despesas pela data da despesa. Garante que o ano actual aparece sempre.
  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    for (const o of orders) {
      if (o.event_date) {
        try { years.add(getYear(parseISO(o.event_date))); } catch {}
      }
    }
    for (const v of vouchers) {
      if (v.created_at) {
        try { years.add(getYear(parseISO(v.created_at))); } catch {}
      }
    }
    for (const e of expenses) {
      if (e.expense_date) {
        try { years.add(getYear(parseISO(e.expense_date))); } catch {}
      }
    }
    return [...years].sort((a, b) => b - a); // mais recente primeiro
  }, [orders, vouchers, expenses, currentYear]);

  // "all" = totais desde sempre (sem filtro de ano)
  const [selectedYear, setSelectedYear] = useState<number | "all">(currentYear);
  const isAllTime = selectedYear === "all";
  const isCurrentYear = selectedYear === currentYear;

  // Quando "Todos": range artificial gigantesco que apanha tudo.
  // Quando ano específico: range Jan→Dez desse ano.
  const yearStart = isAllTime ? new Date(1970, 0, 1) : startOfYear(new Date(selectedYear as number, 0, 1));
  const yearEnd = isAllTime ? new Date(2999, 11, 31) : endOfYear(new Date(selectedYear as number, 11, 31));

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prevMonthStart = startOfMonth(subMonths(now, 1));
  const prevMonthEnd = endOfMonth(subMonths(now, 1));

  const inRange = (iso: string | null, start: Date, end: Date): boolean => {
    if (!iso) return false;
    const d = parseISO(iso);
    return d >= start && d <= end;
  };

  // Pipeline 4-bucket por estado da encomenda — substitui o card "Potencial total" de 3 cells.
  // Cada bucket mostra count + soma de orçamentos (potencial 100% pago) das encomendas
  // nesse bucket. Cancelado fica de fora. Sem-resposta partilha o estado `entrega_flores_agendar`.
  type PipelineBucket = "nao_confirmado" | "confirmado_por_produzir" | "em_producao" | "recebido";
  const statusToBucket = (s: import("@/types/database").OrderStatus): PipelineBucket | null => {
    switch (s) {
      case "cancelado":
        return null;
      case "entrega_flores_agendar":
        return "nao_confirmado";
      case "entrega_agendada":
      case "flores_enviadas":
      case "flores_recebidas":
        return "confirmado_por_produzir";
      case "flores_na_prensa":
      case "reconstrucao_botanica":
      case "a_compor_design":
      case "a_aguardar_aprovacao":
      case "a_finalizar_quadro":
      case "a_ser_emoldurado":
      case "emoldurado":
      case "a_ser_fotografado":
      case "quadro_pronto":
      case "quadro_enviado":
        return "em_producao";
      case "quadro_recebido":
        return "recebido";
    }
  };
  const pipelineBuckets: Record<PipelineBucket, { count: number; total: number }> = {
    nao_confirmado:          { count: 0, total: 0 },
    confirmado_por_produzir: { count: 0, total: 0 },
    em_producao:             { count: 0, total: 0 },
    recebido:                { count: 0, total: 0 },
  };
  for (const o of orders) {
    if (!inRange(o.event_date, yearStart, yearEnd)) continue;
    const b = statusToBucket(o.status);
    if (!b) continue;
    pipelineBuckets[b].count += 1;
    pipelineBuckets[b].total += Number(o.budget) || 0;
  }
  const pipelineTotal =
    pipelineBuckets.nao_confirmado.total +
    pipelineBuckets.confirmado_por_produzir.total +
    pipelineBuckets.em_producao.total +
    pipelineBuckets.recebido.total;

  // KPIs mensais: orders pela data do evento; vales pela data de criação.
  const revenueOrdersMonth = orders
    .filter((o) => inRange(o.event_date, monthStart, monthEnd))
    .reduce((s, o) => s + revenueFromOrder(o), 0);
  const revenueVouchersMonth = vouchers
    .filter((v) => inRange(v.created_at, monthStart, monthEnd))
    .reduce((s, v) => s + revenueFromVoucher(v), 0);
  const revenueMonth = revenueOrdersMonth + revenueVouchersMonth;

  const revenuePrevMonth =
    orders.filter((o) => inRange(o.event_date, prevMonthStart, prevMonthEnd)).reduce((s, o) => s + revenueFromOrder(o), 0) +
    vouchers.filter((v) => inRange(v.created_at, prevMonthStart, prevMonthEnd)).reduce((s, v) => s + revenueFromVoucher(v), 0);

  // "Receita do ano" passa a ser "Receita total" quando isAllTime.
  const revenueYear =
    orders.filter((o) => inRange(o.event_date, yearStart, yearEnd)).reduce((s, o) => s + revenueFromOrder(o), 0) +
    vouchers.filter((v) => inRange(v.created_at, yearStart, yearEnd)).reduce((s, v) => s + revenueFromVoucher(v), 0);

  const expensesMonth = expenses
    .filter((e) => inRange(e.expense_date, monthStart, monthEnd))
    .reduce((s, e) => s + Number(e.amount), 0);
  const expensesYear = expenses
    .filter((e) => inRange(e.expense_date, yearStart, yearEnd))
    .reduce((s, e) => s + Number(e.amount), 0);

  // Custo de produção (COGS) por período: atribuído à mesma janela em que a
  // receita conta, ou seja, pela data do evento da encomenda.
  const cogsMonth = orders
    .filter((o) => inRange(o.event_date, monthStart, monthEnd))
    .reduce((s, o) => s + cogsFromOrder(o), 0);
  const cogsYear = orders
    .filter((o) => inRange(o.event_date, yearStart, yearEnd))
    .reduce((s, o) => s + cogsFromOrder(o), 0);

  // Comissões a parceiros: dedução à receita (decisão Maria 2026-05-19).
  // Conta proporcional ao %pago, excluindo estados `na` e `nao_aceita`.
  const commissionMonth = orders
    .filter((o) => inRange(o.event_date, monthStart, monthEnd))
    .reduce((s, o) => s + commissionFromOrder(o), 0);
  const commissionYear = orders
    .filter((o) => inRange(o.event_date, yearStart, yearEnd))
    .reduce((s, o) => s + commissionFromOrder(o), 0);

  // Receita líquida = bruta − comissões (mostrado como sub-texto debaixo
  // do KPI principal, sem inflar a grelha com mais um KPI por linha).
  const revenueNetMonth = revenueMonth - commissionMonth;
  const revenueNetYear = revenueYear - commissionYear;

  const profitMonth = revenueMonth - expensesMonth - cogsMonth - commissionMonth;
  const profitYear = revenueYear - expensesYear - cogsYear - commissionYear;
  const monthDelta = revenuePrevMonth > 0 ? ((revenueMonth - revenuePrevMonth) / revenuePrevMonth) * 100 : null;

  // Gráfico:
  //  - ano específico: 12 barras (Jan→Dez desse ano)
  //  - "Todos": 1 barra por ano disponível
  const chartData = useMemo(() => {
    if (isAllTime) {
      // Ascendente para o gráfico (mais antigo → mais recente).
      const yearsAsc = [...availableYears].sort((a, b) => a - b);
      return yearsAsc.map((y) => {
        const start = startOfYear(new Date(y, 0, 1));
        const end = endOfYear(new Date(y, 11, 31));
        const rev =
          orders.filter((o) => inRange(o.event_date, start, end)).reduce((s, o) => s + revenueFromOrder(o), 0) +
          vouchers.filter((v) => inRange(v.created_at, start, end)).reduce((s, v) => s + revenueFromVoucher(v), 0);
        const exp = expenses.filter((e) => inRange(e.expense_date, start, end)).reduce((s, e) => s + Number(e.amount), 0);
        const cogs = orders.filter((o) => inRange(o.event_date, start, end)).reduce((s, o) => s + cogsFromOrder(o), 0);
        return {
          key: String(y),
          label: String(y),
          revenue: rev,
          expenses: exp,
          cogs,
        };
      });
    }
    const buckets: { key: string; label: string; revenue: number; expenses: number; cogs: number }[] = [];
    for (let m = 0; m < 12; m++) {
      const start = startOfMonth(new Date(selectedYear as number, m, 1));
      const end = endOfMonth(new Date(selectedYear as number, m, 1));
      const rev =
        orders.filter((o) => inRange(o.event_date, start, end)).reduce((s, o) => s + revenueFromOrder(o), 0) +
        vouchers.filter((v) => inRange(v.created_at, start, end)).reduce((s, v) => s + revenueFromVoucher(v), 0);
      const exp = expenses.filter((e) => inRange(e.expense_date, start, end)).reduce((s, e) => s + Number(e.amount), 0);
      const cogs = orders.filter((o) => inRange(o.event_date, start, end)).reduce((s, o) => s + cogsFromOrder(o), 0);
      buckets.push({
        key: format(start, "yyyy-MM"),
        label: format(start, "MMM", { locale: pt }),
        revenue: rev,
        expenses: exp,
        cogs,
      });
    }
    return buckets;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, vouchers, expenses, selectedYear, isAllTime, availableYears]);

  const maxBarValue = Math.max(...chartData.map((m) => Math.max(m.revenue, m.expenses, m.cogs)), 1);

  return (
    <div className="space-y-4">
      {/* Selector de ano */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-cocoa-700" />
          <span className="text-sm font-medium text-cocoa-900">Ano:</span>
          <Select
            value={isAllTime ? "all" : String(selectedYear)}
            onValueChange={(v) => setSelectedYear(v === "all" ? "all" : Number(v))}
          >
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos (desde sempre)</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}{y === currentYear ? " (actual)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-cocoa-700 italic">
          Encomendas contam pelo ano da <strong>data do evento</strong>; vales pelo ano de <strong>criação</strong>.
        </p>
      </div>

      {/* KPIs principais — Receita / Despesas / COGS / Comissões / Lucro
          A receita mostra "líquida" (= bruta − comissões) como sub-texto. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {isCurrentYear ? (
          <>
            <KpiBox
              label="Receita do mês"
              value={formatEUR(revenueMonth)}
              icon={<TrendingUp className="h-4 w-4" />}
              color="emerald"
              delta={monthDelta}
              subLabel="Líquida"
              subValue={commissionMonth > 0 ? formatEUR(revenueNetMonth) : undefined}
            />
            <KpiBox label="Despesas do mês" value={formatEUR(expensesMonth)} icon={<ArrowDownRight className="h-4 w-4" />} color="rose" />
            <KpiBox label="Custo de produção" value={formatEUR(cogsMonth)} icon={<Frame className="h-4 w-4" />} color="amber" />
            <KpiBox label="Comissões do mês" value={formatEUR(commissionMonth)} icon={<Handshake className="h-4 w-4" />} color="violet" />
            <KpiBox
              label="Lucro do mês"
              value={formatEUR(profitMonth)}
              icon={<CreditCard className="h-4 w-4" />}
              color={profitMonth >= 0 ? "emerald" : "rose"}
            />
          </>
        ) : (
          <>
            <KpiBox
              label={isAllTime ? "Receita total" : `Receita ${selectedYear}`}
              value={formatEUR(revenueYear)}
              icon={<ArrowUpRight className="h-4 w-4" />}
              color="sky"
              subLabel="Líquida"
              subValue={commissionYear > 0 ? formatEUR(revenueNetYear) : undefined}
            />
            <KpiBox label={isAllTime ? "Despesas totais" : `Despesas ${selectedYear}`} value={formatEUR(expensesYear)} icon={<Receipt className="h-4 w-4" />} color="rose" />
            <KpiBox label={isAllTime ? "Custo produção total" : `Custo produção ${selectedYear}`} value={formatEUR(cogsYear)} icon={<Frame className="h-4 w-4" />} color="amber" />
            <KpiBox label={isAllTime ? "Comissões totais" : `Comissões ${selectedYear}`} value={formatEUR(commissionYear)} icon={<Handshake className="h-4 w-4" />} color="violet" />
            <KpiBox label={isAllTime ? "Lucro total" : `Lucro ${selectedYear}`} value={formatEUR(profitYear)} icon={<TrendingUp className="h-4 w-4" />} color={profitYear >= 0 ? "emerald" : "rose"} />
          </>
        )}
      </div>

      {isCurrentYear && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiBox
            label={`Receita ${selectedYear}`}
            value={formatEUR(revenueYear)}
            icon={<ArrowUpRight className="h-4 w-4" />}
            color="sky"
            subLabel="Líquida"
            subValue={commissionYear > 0 ? formatEUR(revenueNetYear) : undefined}
          />
          <KpiBox label={`Despesas ${selectedYear}`} value={formatEUR(expensesYear)} icon={<Receipt className="h-4 w-4" />} color="rose" />
          <KpiBox label={`Custo produção ${selectedYear}`} value={formatEUR(cogsYear)} icon={<Frame className="h-4 w-4" />} color="amber" />
          <KpiBox label={`Comissões ${selectedYear}`} value={formatEUR(commissionYear)} icon={<Handshake className="h-4 w-4" />} color="violet" />
          <KpiBox label={`Lucro ${selectedYear}`} value={formatEUR(profitYear)} icon={<TrendingUp className="h-4 w-4" />} color={profitYear >= 0 ? "emerald" : "rose"} />
        </div>
      )}

      {/* Pipeline financeiro por estado da encomenda — 4 buckets do menos para o mais certo */}
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 dark:border-violet-900/50 p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-9 w-9 rounded-xl bg-violet-200/60 dark:bg-violet-900/40 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-violet-700 dark:text-violet-300" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
                {isAllTime
                  ? "Pipeline (desde sempre) — orçamento total por fase"
                  : `Pipeline ${selectedYear} — orçamento total por fase`}
              </h3>
              <span className="text-xs text-violet-800 dark:text-violet-300 tabular-nums">
                Total: <strong>{formatEUR(pipelineTotal)}</strong>
              </span>
            </div>
            <p className="text-xs text-violet-800/80 dark:text-violet-300/80 mt-0.5">
              {isAllTime
                ? "Soma dos orçamentos por estado da encomenda, em qualquer ano. Cancelado e vales não somam aqui."
                : `Soma dos orçamentos por estado, encomendas com data de evento em ${selectedYear}. Cancelado e vales não somam aqui.`}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <PipelineBucket
            label="Não confirmado"
            helper="Pré-reservas e sem-resposta"
            count={pipelineBuckets.nao_confirmado.count}
            total={pipelineBuckets.nao_confirmado.total}
            color="amber"
          />
          <PipelineBucket
            label="Confirmado, por produzir"
            helper="Entrega agendada / flores em trânsito"
            count={pipelineBuckets.confirmado_por_produzir.count}
            total={pipelineBuckets.confirmado_por_produzir.total}
            color="sky"
          />
          <PipelineBucket
            label="Em produção / pronto"
            helper="Da prensa ao quadro enviado"
            count={pipelineBuckets.em_producao.count}
            total={pipelineBuckets.em_producao.total}
            color="violet"
          />
          <PipelineBucket
            label="Recebido pelo cliente"
            helper="Quadros entregues"
            count={pipelineBuckets.recebido.count}
            total={pipelineBuckets.recebido.total}
            color="emerald"
          />
        </div>
      </div>

      {/* Bar chart: 12 meses do ano ou 1 barra por ano se "Todos" */}
      <div className="rounded-xl border border-cream-200 bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-cocoa-900">
            {isAllTime ? "Receita vs despesas vs custo de produção por ano" : `Receita vs despesas vs custo de produção — ${selectedYear}`}
          </h3>
          <div className="flex items-center gap-3 text-xs text-cocoa-700">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-400" />Receita
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-400" />Despesas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-400" />Produção
            </span>
          </div>
        </div>
        <div className="flex items-end gap-1 h-48">
          {chartData.map((m) => (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center gap-0.5 h-40">
                <div
                  className="w-2 sm:w-2.5 bg-emerald-400 rounded-t transition-all"
                  style={{ height: `${(m.revenue / maxBarValue) * 100}%` }}
                  title={`Receita: ${formatEUR(m.revenue)}`}
                />
                <div
                  className="w-2 sm:w-2.5 bg-rose-400 rounded-t transition-all"
                  style={{ height: `${(m.expenses / maxBarValue) * 100}%` }}
                  title={`Despesas: ${formatEUR(m.expenses)}`}
                />
                <div
                  className="w-2 sm:w-2.5 bg-amber-400 rounded-t transition-all"
                  style={{ height: `${(m.cogs / maxBarValue) * 100}%` }}
                  title={`Custo de produção: ${formatEUR(m.cogs)}`}
                />
              </div>
              <span className="text-[10px] text-cocoa-700 capitalize">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-cocoa-700 italic px-1">
        <strong>Receita (bruta)</strong> = soma proporcional do orçamento das encomendas conforme o estado de pagamento (100%=100%, 70%=70%, 30%=30%) + vales 100% pagos ainda não convertidos em preservação (evita dupla contagem). <strong>Receita líquida</strong> (mostrada por baixo quando aplicável) = receita bruta − comissões a parceiros. <strong>Custo de produção</strong> = soma do COGS de cada encomenda (snapshot capturado na criação, calculado a partir do tamanho, fundo, tipo de moldura e extras) também proporcional ao % pago. <strong>Comissões</strong> = parte da receita devida a parceiros recomendadores, contada proporcional ao % pago; estados "N/A" e "Não aceita" não somam. <strong>Despesas</strong> = custos fixos (subscrições + únicos) na data da despesa. <strong>Lucro</strong> = receita bruta − despesas − custo de produção − comissões. Encomendas, comissões e custo de produção atribuídos ao período pela data do evento; vales pela data de criação. Encomendas anteriores à mig 034 não têm snapshot e não somam para o COGS. Para métricas mais detalhadas, ver a aba Métricas.
      </p>
    </div>
  );
}

function KpiBox({
  label,
  value,
  icon,
  color,
  delta,
  subValue,
  subLabel,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "emerald" | "rose" | "sky" | "amber" | "slate" | "violet";
  delta?: number | null;
  subValue?: string;
  subLabel?: string;
}) {
  const palette: Record<string, string> = {
    emerald: "from-emerald-50 to-emerald-100/60 border-emerald-200 text-emerald-800",
    rose:    "from-rose-50 to-rose-100/60 border-rose-200 text-rose-800",
    sky:     "from-sky-50 to-sky-100/60 border-sky-200 text-sky-800",
    amber:   "from-amber-50 to-amber-100/60 border-amber-200 text-amber-800",
    slate:   "from-slate-50 to-slate-100/60 border-slate-200 text-slate-800",
    violet:  "from-violet-50 to-violet-100/60 border-violet-200 text-violet-800",
  };
  return (
    <div className={cn("rounded-xl border bg-gradient-to-br p-4 space-y-1", palette[color])}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider opacity-80 font-medium">{label}</p>
        {icon}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
      {subValue && (
        <p className="text-[11px] opacity-75 tabular-nums">
          {subLabel ? <span className="opacity-80">{subLabel}: </span> : null}{subValue}
        </p>
      )}
      {delta !== undefined && delta !== null && (
        <p className={cn("text-xs font-medium", delta >= 0 ? "text-emerald-700" : "text-rose-700")}>
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% vs. mês anterior
        </p>
      )}
    </div>
  );
}

function PipelineBucket({
  label,
  helper,
  count,
  total,
  color,
}: {
  label: string;
  helper: string;
  count: number;
  total: number;
  color: "amber" | "sky" | "violet" | "emerald";
}) {
  const palette: Record<string, { border: string; bg: string; text: string; subtext: string }> = {
    amber:   { border: "border-amber-200 dark:border-amber-900/40",   bg: "bg-surface/80 dark:bg-[#1B1611]/40", text: "text-amber-900 dark:text-amber-200",   subtext: "text-amber-700 dark:text-amber-300" },
    sky:     { border: "border-sky-200 dark:border-sky-900/40",       bg: "bg-surface/80 dark:bg-[#1B1611]/40", text: "text-sky-900 dark:text-sky-200",       subtext: "text-sky-700 dark:text-sky-300" },
    violet:  { border: "border-violet-200 dark:border-violet-900/40", bg: "bg-surface/80 dark:bg-[#1B1611]/40", text: "text-violet-900 dark:text-violet-200", subtext: "text-violet-700 dark:text-violet-300" },
    emerald: { border: "border-emerald-200 dark:border-emerald-900/40", bg: "bg-surface/80 dark:bg-[#1B1611]/40", text: "text-emerald-900 dark:text-emerald-200", subtext: "text-emerald-700 dark:text-emerald-300" },
  };
  const c = palette[color];
  return (
    <div className={cn("rounded-xl border p-3 space-y-1", c.bg, c.border)}>
      <div className={cn("text-[10px] uppercase tracking-wider font-medium", c.subtext)}>{label}</div>
      <div className={cn("text-2xl font-semibold tabular-nums", c.text)}>{formatEUR(total)}</div>
      <div className={cn("text-[11px]", c.subtext)}>
        {count} {count === 1 ? "encomenda" : "encomendas"} · {helper}
      </div>
    </div>
  );
}

// ============================================================
// COMPETIÇÃO
// ============================================================

function CompeticaoTab({
  competitors,
  canEdit,
}: {
  competitors: Competitor[];
  canEdit: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return competitors;
    const q = search.trim().toLowerCase();
    return competitors.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.location_label ?? "").toLowerCase().includes(q) ||
        c.websites.some((w) => w.toLowerCase().includes(q)),
    );
  }, [competitors, search]);

  // Estatísticas de referência: preço médio do nosso quadro mais pequeno
  // calculado a partir das tabelas dos concorrentes (referência visual).
  const stats = useMemo(() => {
    const allPrices = competitors.flatMap((c) => c.prices);
    const validPrices = allPrices.filter((p) => p.price !== null && p.price > 0);
    if (validPrices.length === 0) {
      return { count: competitors.length, avgPrice: null, minPrice: null, maxPrice: null };
    }
    const sum = validPrices.reduce((s, p) => s + (p.price ?? 0), 0);
    const prices = validPrices.map((p) => p.price!).sort((a, b) => a - b);
    return {
      count: competitors.length,
      avgPrice: sum / validPrices.length,
      minPrice: prices[0],
      maxPrice: prices[prices.length - 1],
    };
  }, [competitors]);

  return (
    <div className="space-y-4">
      {/* KPIs / sumário */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Concorrentes registados" value={String(stats.count)} color="from-violet-50 to-purple-100 border-violet-200" />
        <StatCard label="Preço médio (todos os produtos)" value={formatEUR(stats.avgPrice)} color="from-sky-50 to-blue-100 border-sky-200" />
        <StatCard label="Preço mais baixo" value={formatEUR(stats.minPrice)} color="from-emerald-50 to-green-100 border-emerald-200" />
        <StatCard label="Preço mais alto" value={formatEUR(stats.maxPrice)} color="from-amber-50 to-orange-100 border-amber-200" />
      </div>

      {/* Toolbar: search + novo */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cocoa-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar por nome, localização ou site…"
            className="pl-9 h-9"
          />
        </div>
        {canEdit && (
          <Button onClick={() => setShowNew(true)} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="h-4 w-4 mr-1" />
            Novo concorrente
          </Button>
        )}
      </div>

      {showNew && canEdit && (
        <NewCompetitorForm onClose={() => setShowNew(false)} />
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cream-200 bg-cream-50 p-12 text-center space-y-2">
          <Swords className="h-8 w-8 text-violet-400 mx-auto" />
          <p className="text-sm text-cocoa-700">
            {search.trim()
              ? `Nenhum concorrente corresponde a "${search}".`
              : "Ainda não há concorrentes registados."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <CompetitorCard key={c.id} competitor={c} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-4 space-y-1",
        color,
      )}
    >
      <div className="text-[10px] uppercase tracking-wider font-semibold text-cocoa-900/60 dark:text-[#E8D5B5]/60">
        {label}
      </div>
      <div className="text-xl font-bold text-cocoa-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function NewCompetitorForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    startTransition(async () => {
      try {
        await createCompetitorAction({
          name: name.trim(),
          websites: website.trim() ? [website.trim()] : [],
          location_label: location.trim() || null,
        });
        toast.success("Concorrente adicionado.");
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falhou.");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/30 dark:bg-violet-950/20 p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-cocoa-900">
        Novo concorrente
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-cocoa-700">Nome *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: PressedFlowers Co." />
        </div>
        <div>
          <label className="text-xs text-cocoa-700">Site principal</label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className="text-xs text-cocoa-700">Localização</label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Lisboa / PT" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pending} className="bg-violet-600 hover:bg-violet-700 text-white">
          <Save className="h-4 w-4 mr-1" />
          {pending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function CompetitorCard({
  competitor,
  canEdit,
}: {
  competitor: Competitor;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const minPrice = useMemo(() => {
    const valid = competitor.prices.filter((p) => p.price !== null && p.price > 0);
    if (valid.length === 0) return null;
    return Math.min(...valid.map((p) => p.price!));
  }, [competitor.prices]);

  async function archive() {
    if (!confirm(`Arquivar "${competitor.name}"?`)) return;
    try {
      await archiveCompetitorAction(competitor.id);
      toast.success("Concorrente arquivado.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falhou.");
    }
  }

  if (editing) {
    return (
      <EditCompetitorCard
        competitor={competitor}
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-cream-200 bg-surface p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-cocoa-900">
            {competitor.name}
          </h3>
          {competitor.location_label && (
            <div className="inline-flex items-center gap-1 text-xs text-cocoa-700">
              <MapPin className="h-3 w-3" />
              {competitor.location_label}
              {competitor.country && competitor.country !== "PT" && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-300">
                  {competitor.country}
                </span>
              )}
            </div>
          )}
        </div>
        {minPrice !== null && (
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-cocoa-700">A partir de</div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatEUR(minPrice)}
            </div>
          </div>
        )}
      </div>

      {competitor.websites.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {competitor.websites.map((url, idx) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-900/50 hover:bg-sky-200 dark:hover:bg-sky-950/60 transition-colors"
            >
              <Globe className="h-3 w-3" />
              {prettyDomain(url)}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          ))}
        </div>
      )}

      {competitor.prices.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-cocoa-700">
            Tabela de preços
          </div>
          <div className="space-y-1">
            {competitor.prices.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm py-1 border-b border-cream-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-cocoa-900 truncate">
                    {p.product || "—"}
                  </div>
                  {p.notes && (
                    <div className="text-[11px] text-cocoa-700 truncate">
                      {p.notes}
                    </div>
                  )}
                </div>
                <div className="tabular-nums font-semibold text-cocoa-900 shrink-0">
                  {formatEUR(p.price)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {competitor.notes && (
        <div className="text-xs text-cocoa-700 italic border-l-2 border-amber-300 pl-2">
          {competitor.notes}
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2 pt-1 border-t border-cream-100">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button size="sm" variant="outline" onClick={archive} className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Arquivar
          </Button>
        </div>
      )}
    </div>
  );
}

function EditCompetitorCard({
  competitor,
  onClose,
}: {
  competitor: Competitor;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(competitor.name);
  const [location, setLocation] = useState(competitor.location_label ?? "");
  const [country, setCountry] = useState(competitor.country ?? "PT");
  const [websites, setWebsites] = useState<string[]>(
    competitor.websites.length ? competitor.websites : [""],
  );
  const [prices, setPrices] = useState<CompetitorPrice[]>(
    competitor.prices.length ? competitor.prices : [{ product: "", price: null, notes: null }],
  );
  const [notes, setNotes] = useState(competitor.notes ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await updateCompetitorAction(competitor.id, {
          name: name.trim() || competitor.name,
          location_label: location.trim() || null,
          country: country.trim() || "PT",
          websites: websites.map((w) => w.trim()).filter(Boolean),
          prices: prices
            .filter((p) => p.product.trim() || p.price !== null)
            .map((p) => ({
              product: p.product.trim(),
              price: p.price,
              notes: p.notes?.trim() || null,
            })),
          notes: notes.trim() || null,
        });
        toast.success("Concorrente actualizado.");
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falhou.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-violet-300 dark:border-violet-900/60 bg-violet-50/30 dark:bg-violet-950/20 p-5 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-cocoa-700">Nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="text-xs text-cocoa-700">Localização</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Porto" />
          </div>
          <div>
            <label className="text-xs text-cocoa-700">País</label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="PT" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-cocoa-700">Sites / redes</label>
        <div className="space-y-1.5 mt-1">
          {websites.map((w, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={w}
                onChange={(e) => {
                  const next = [...websites];
                  next[idx] = e.target.value;
                  setWebsites(next);
                }}
                placeholder="https://…"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWebsites(websites.filter((_, i) => i !== idx))}
                disabled={websites.length === 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setWebsites([...websites, ""])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar site
          </Button>
        </div>
      </div>

      <div>
        <label className="text-xs text-cocoa-700">Tabela de preços</label>
        <div className="space-y-1.5 mt-1">
          {prices.map((p, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2">
              <Input
                className="col-span-5"
                value={p.product}
                onChange={(e) => {
                  const next = [...prices];
                  next[idx] = { ...p, product: e.target.value };
                  setPrices(next);
                }}
                placeholder="Produto (ex.: Quadro 30x40)"
              />
              <Input
                className="col-span-2"
                type="number"
                step="0.01"
                value={p.price ?? ""}
                onChange={(e) => {
                  const next = [...prices];
                  next[idx] = {
                    ...p,
                    price: e.target.value === "" ? null : parseFloat(e.target.value),
                  };
                  setPrices(next);
                }}
                placeholder="€"
              />
              <Input
                className="col-span-4"
                value={p.notes ?? ""}
                onChange={(e) => {
                  const next = [...prices];
                  next[idx] = { ...p, notes: e.target.value };
                  setPrices(next);
                }}
                placeholder="Notas (opcional)"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-span-1"
                onClick={() => setPrices(prices.filter((_, i) => i !== idx))}
                disabled={prices.length === 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPrices([...prices, { product: "", price: null, notes: null }])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar produto
          </Button>
        </div>
      </div>

      <div>
        <label className="text-xs text-cocoa-700">Notas</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Save className="h-4 w-4 mr-1" />
          {pending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

function prettyDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

// ============================================================
// CUSTOS DE PRODUÇÃO (COGS) — Custo real por quadro completo
// ============================================================
// Distinto da tabela de preços (que é o preço de venda ao cliente).
// Aqui guardamos o custo da Maria a produzir cada quadro: moldura,
// embalagem, cartão informativo, enchimento, autocolante, etc.
//
// 3 variáveis: tamanho × tipo de moldura × tipo de vidro.
//   - Tamanhos: 30x40 (A3), 40x50, 50x70, mini 20x25.
//   - Tipo de moldura: baixa (2x2cm), caixa (2x3cm), pirâmide.
//     Baixa vs caixa é decisão INTERNA (consoante a altura das flores).
//     Pirâmide é a única visível ao cliente (upgrade pago).
//   - Tipo de vidro: vidro sobre vidro (fundo transparente) ou
//     vidro sobre cartão (preto/branco/cor/fotografia).
//
// Bonus: tabela "Impressão de fotografia" — somada ao custo do quadro
// quando o cliente escolhe fundo fotografia.

const PRODUCTION_SIZES_ORDER: ProductionCostSize[] = [
  "30x40",
  "40x50",
  "50x70",
  "mini_20x25",
];

const PRODUCTION_FRAME_TYPES_ORDER: ProductionFrameType[] = [
  "baixa",
  "caixa",
  "piramide",
];

const PRODUCTION_GLASS_TYPES_ORDER: ProductionGlassType[] = [
  "vidro_vidro",
  "vidro_cartao",
];

function CustosTab({
  items,
  canEdit,
}: {
  items: ProductionCostItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState<string | null>(null);

  // Index para lookup rápido.
  const frameByKey = useMemo(() => {
    const map = new Map<string, ProductionCostItem>();
    for (const it of items) {
      if (it.kind !== "frame") continue;
      map.set(`${it.size_key}|${it.frame_type}|${it.glass_type}`, it);
    }
    return map;
  }, [items]);

  const photoBySize = useMemo(() => {
    const map = new Map<string, ProductionCostItem>();
    for (const it of items) {
      if (it.kind !== "photo_print") continue;
      map.set(it.size_key, it);
    }
    return map;
  }, [items]);

  // Consumables agrupados por label. Mantemos a ordem pela menor
  // `position` do grupo (o seed posicionou os 3 tamanhos lado a lado).
  const consumableGroups = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; minPosition: number; items: Map<string, ProductionCostItem> }
    >();
    for (const it of items) {
      if (it.kind !== "consumable" || !it.label) continue;
      const g = groups.get(it.label) ?? {
        label: it.label,
        minPosition: it.position,
        items: new Map<string, ProductionCostItem>(),
      };
      g.minPosition = Math.min(g.minPosition, it.position);
      g.items.set(it.size_key, it);
      groups.set(it.label, g);
    }
    return [...groups.values()].sort((a, b) => a.minPosition - b.minPosition);
  }, [items]);

  function saveCost(item: ProductionCostItem, raw: string) {
    const next = raw.trim() === "" ? 0 : Number(raw.replace(",", "."));
    if (Number.isNaN(next) || next < 0) {
      toast.error("Custo inválido");
      return;
    }
    if (next === item.cost) return;
    setSaving(item.id);
    startTransition(async () => {
      try {
        await updateProductionCostItemAction(item.id, { cost: next });
        toast.success(`${describe(item)}: ${formatEUR(next)}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao guardar");
      } finally {
        setSaving(null);
      }
    });
  }

  function createConsumable(label: string, onDone: () => void) {
    startTransition(async () => {
      try {
        await createConsumableAction(label);
        toast.success(`"${label}" adicionado.`);
        onDone();
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao adicionar");
      }
    });
  }

  function archiveConsumable(label: string) {
    if (!window.confirm(`Remover "${label}"? Encomendas antigas não são afectadas.`)) return;
    startTransition(async () => {
      try {
        await archiveConsumableAction(label);
        toast.success(`"${label}" removido.`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao remover");
      }
    });
  }

  function renameConsumable(oldLabel: string, newLabel: string) {
    if (newLabel.trim() === oldLabel || newLabel.trim().length === 0) return;
    startTransition(async () => {
      try {
        await renameConsumableAction(oldLabel, newLabel.trim());
        toast.success(`"${oldLabel}" → "${newLabel.trim()}"`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao renomear");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Aviso explicativo */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 flex gap-3">
        <Frame className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
          <p className="font-semibold mb-1">Como funcionam os custos de produção</p>
          <p>
            Estes são os custos REAIS de produzir cada produto vendável
            (moldura, embalagem, cartão, enchimento, autocolante, etc.) —
            distintos das despesas únicas. Cada encomenda guarda um snapshot
            dos custos vigentes no dia da criação; <strong>alterações aqui
            não recalculam encomendas antigas</strong>.
          </p>
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">
            <strong>Vidro sobre vidro</strong> = cliente escolheu fundo transparente.{" "}
            <strong>Vidro sobre cartão</strong> = preto, branco, cor ou fotografia.{" "}
            Baixa vs caixa é decisão interna (consoante a altura das flores);
            o cliente paga o mesmo, só a margem muda. Pirâmide é o único upgrade
            que o cliente também paga.
          </p>
          {!canEdit && (
            <p className="mt-2 italic text-amber-700 dark:text-amber-300">
              Modo leitura — só administradores podem editar.
            </p>
          )}
        </div>
      </div>

      {/* Grelha 4 cards: um por tamanho */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3">
        {PRODUCTION_SIZES_ORDER.map((size) => (
          <div
            key={size}
            className="rounded-2xl border bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200 p-3 sm:p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <Frame className="h-4 w-4 text-amber-700" />
              <h2 className="text-sm font-semibold text-cocoa-900">
                {PRODUCTION_SIZE_LABELS[size]}
              </h2>
            </div>
            <div className="rounded-xl bg-surface overflow-hidden border border-white/40">
              <table className="w-full text-xs">
                <thead className="bg-cream-50 text-[10px] uppercase tracking-wide text-cocoa-700">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium" />
                    {PRODUCTION_GLASS_TYPES_ORDER.map((g) => (
                      <th key={g} className="text-left px-2 py-1.5 font-medium">
                        {g === "vidro_vidro" ? "Vidro" : "Cartão"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PRODUCTION_FRAME_TYPES_ORDER.map((ft) => (
                    <tr key={ft} className="border-t border-cream-100">
                      <td className="px-2 py-1.5 align-middle text-xs font-medium text-cocoa-900">
                        {PRODUCTION_FRAME_TYPE_SHORT[ft]}
                      </td>
                      {PRODUCTION_GLASS_TYPES_ORDER.map((gt) => {
                        const item = frameByKey.get(`${size}|${ft}|${gt}`);
                        return (
                          <td key={gt} className="px-1 py-1 align-middle">
                            {item ? (
                              <CostInput
                                item={item}
                                canEdit={canEdit}
                                saving={saving === item.id}
                                onSave={(v) => saveCost(item, v)}
                              />
                            ) : (
                              <span className="text-cocoa-500 text-xs">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* Card: Impressão de fotografia */}
      <div className="rounded-2xl border bg-gradient-to-br from-violet-50 to-purple-100 border-violet-200 p-3 sm:p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-violet-700" />
          <h2 className="text-sm font-semibold text-cocoa-900">
            Impressão de fotografia
          </h2>
          <span className="text-[11px] text-cocoa-700">
            Somado ao custo do quadro quando o cliente escolhe fundo fotografia
          </span>
        </div>
        <div className="rounded-xl bg-surface border border-white/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-50 text-[10px] uppercase tracking-wide text-cocoa-700">
              <tr>
                {PRODUCTION_SIZES_ORDER.map((s) => (
                  <th key={s} className="text-left px-3 py-1.5 font-medium">
                    {PRODUCTION_SIZE_LABELS[s]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {PRODUCTION_SIZES_ORDER.map((s) => {
                  const it = photoBySize.get(s);
                  return (
                    <td key={s} className="px-2 py-2 align-middle">
                      {it ? (
                        <CostInput
                          item={it}
                          canEdit={canEdit}
                          saving={saving === it.id}
                          onSave={(v) => saveCost(it, v)}
                        />
                      ) : (
                        <span className="text-cocoa-500 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Card: Outros custos recorrentes (consumíveis por encomenda) */}
      <ConsumablesSection
        groups={consumableGroups}
        canEdit={canEdit}
        saving={saving}
        onSaveCost={saveCost}
        onCreate={createConsumable}
        onArchive={archiveConsumable}
        onRename={renameConsumable}
      />
    </div>
  );
}

function ConsumablesSection({
  groups,
  canEdit,
  saving,
  onSaveCost,
  onCreate,
  onArchive,
  onRename,
}: {
  groups: Array<{ label: string; items: Map<string, ProductionCostItem> }>;
  canEdit: boolean;
  saving: string | null;
  onSaveCost: (item: ProductionCostItem, raw: string) => void;
  onCreate: (label: string, onDone: () => void) => void;
  onArchive: (label: string) => void;
  onRename: (oldLabel: string, newLabel: string) => void;
}) {
  const [newLabel, setNewLabel] = useState("");

  // Produtos vendáveis (4 tamanhos físicos + 2 extras autónomos, mig 056).
  // Cada consumível tem 6 linhas — uma por produto. Maria edita custo onde
  // o consumível se aplica e deixa 0 nos restantes.
  const sizes: ProductionCostSize[] = [
    "30x40",
    "40x50",
    "50x70",
    "mini_20x25",
    "christmas_ornament",
    "necklace_pendant",
  ];

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-rose-50 to-pink-100 border-rose-200 p-3 sm:p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-rose-700" />
        <h2 className="text-sm font-semibold text-cocoa-900">
          Outros custos recorrentes
        </h2>
        <span className="text-[11px] text-cocoa-700">
          Custo por produto vendável (tamanho do quadro ou extra autónomo)
        </span>
      </div>
      <div className="rounded-xl bg-surface border border-white/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-50 text-[10px] uppercase tracking-wide text-cocoa-700">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium">Item</th>
              {sizes.map((s) => (
                <th key={s} className="text-left px-3 py-1.5 font-medium w-32">
                  {PRODUCTION_SIZE_LABELS[s]}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={sizes.length + 2} className="px-3 py-4 text-xs text-cocoa-500 italic text-center">
                  Sem consumíveis ainda. Adiciona em baixo.
                </td>
              </tr>
            )}
            {groups.map((g) => (
              <tr key={g.label} className="border-t border-cream-100">
                <td className="px-3 py-1.5 align-middle">
                  <ConsumableLabelInput
                    label={g.label}
                    canEdit={canEdit}
                    onRename={(v) => onRename(g.label, v)}
                  />
                </td>
                {sizes.map((s) => {
                  const item = g.items.get(s);
                  return (
                    <td key={s} className="px-2 py-1 align-middle">
                      {item ? (
                        <CostInput
                          item={item}
                          canEdit={canEdit}
                          saving={saving === item.id}
                          onSave={(v) => onSaveCost(item, v)}
                        />
                      ) : (
                        <span className="text-cocoa-500 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1 align-middle text-right">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onArchive(g.label)}
                      className="inline-flex items-center justify-center h-7 w-7 rounded-md text-rose-600 hover:bg-rose-100 transition-colors"
                      title={`Remover "${g.label}"`}
                      aria-label={`Remover ${g.label}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {canEdit && (
              <tr className="border-t border-cream-100 bg-rose-50/50">
                <td colSpan={sizes.length + 2} className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Plus className="h-3.5 w-3.5 text-rose-700 shrink-0" />
                    <Input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newLabel.trim().length > 0) {
                          e.preventDefault();
                          onCreate(newLabel.trim(), () => setNewLabel(""));
                        }
                      }}
                      placeholder="Novo item (ex: Cartão de visita)"
                      className="h-7 flex-1 text-xs"
                    />
                    <button
                      type="button"
                      disabled={newLabel.trim().length === 0}
                      onClick={() =>
                        onCreate(newLabel.trim(), () => setNewLabel(""))
                      }
                      className="h-7 px-3 rounded-md bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Adicionar
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConsumableLabelInput({
  label,
  canEdit,
  onRename,
}: {
  label: string;
  canEdit: boolean;
  onRename: (v: string) => void;
}) {
  const [draft, setDraft] = useState(label);
  const [lastLabel, setLastLabel] = useState(label);
  if (label !== lastLabel) {
    setLastLabel(label);
    setDraft(label);
  }
  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim();
        if (trimmed.length === 0) {
          setDraft(label); // não permite vazio — reverte
          return;
        }
        if (trimmed !== label) onRename(trimmed);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(label);
          (e.target as HTMLInputElement).blur();
        }
      }}
      disabled={!canEdit}
      className="h-7 text-xs font-medium border-transparent hover:border-cream-200 focus:border-rose-300 bg-transparent focus:bg-surface transition-colors"
    />
  );
}

function CostInput({
  item,
  canEdit,
  saving,
  onSave,
}: {
  item: ProductionCostItem;
  canEdit: boolean;
  saving: boolean;
  onSave: (raw: string) => void;
}) {
  const [draft, setDraft] = useState(item.cost.toString().replace(".", ","));
  // Padrão "store info from previous renders" — re-sincroniza o draft local
  // quando a BD muda (ex: outro admin editou) sem useEffect+setState.
  const [lastItemId, setLastItemId] = useState(item.id);
  const [lastCost, setLastCost] = useState(item.cost);
  if (item.id !== lastItemId || item.cost !== lastCost) {
    setLastItemId(item.id);
    setLastCost(item.cost);
    setDraft(item.cost.toString().replace(".", ","));
  }
  return (
    <div className="relative inline-block w-full max-w-[100px]">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onSave(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        disabled={!canEdit || saving}
        inputMode="decimal"
        className="h-7 w-full pr-5 text-xs font-medium tabular-nums"
        placeholder="0,00"
      />
      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] text-cocoa-500">
        €
      </span>
    </div>
  );
}

// Descrição curta usada nas notificações toast.
function describe(item: ProductionCostItem): string {
  if (item.kind === "photo_print") {
    return `Impressão fotografia ${PRODUCTION_SIZE_LABELS[item.size_key]}`;
  }
  const ft = item.frame_type ?? "";
  const gt = item.glass_type ?? "";
  return `${PRODUCTION_SIZE_LABELS[item.size_key]} · ${PRODUCTION_FRAME_TYPE_LABELS[ft as ProductionFrameType] ?? ft} · ${PRODUCTION_GLASS_TYPE_LABELS[gt as ProductionGlassType] ?? gt}`;
}
