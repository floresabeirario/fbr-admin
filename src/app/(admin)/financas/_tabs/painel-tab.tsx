"use client";

// ============================================================
// PAINEL (resumo executivo) — extraído de financas-client.tsx
// ============================================================

import { useMemo } from "react";
import {
  Tags,
  Receipt,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Sparkles,
  Frame,
  Package,
  Handshake,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, getYear } from "date-fns";
import { pt } from "date-fns/locale";
import { formatDateTimeLisbon } from "@/lib/format-date";
import { formatEUR } from "@/lib/format";
import {
  orderPnL,
  aggregateExpensesByAccountingType,
  ACCOUNTING_TYPE_LABELS,
  commissionFullFromVoucher,
  voucherCodesWithCommission,
  orderCommissionSuppressedByVoucher,
} from "@/lib/finance";
import { FRAME_SIZE_LABELS, FRAME_BACKGROUND_LABELS } from "@/types/database";
import type { FrameSize, FrameBackground } from "@/types/database";
import type { Expense } from "@/types/expense";
import { KpiBox, inRangeISO, type FaturacaoOrder, type FaturacaoVoucher } from "./shared";

export function PainelTab({
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
  // A função vive dentro do useMemo para as deps ficarem completas
  // (react-hooks/exhaustive-deps).
  const { month, prevMonth } = useMemo(() => {
    // Vales que já carregam comissão contada → suprime a comissão das
    // encomendas que vieram desses vales (não recontar; decisão Maria s116).
    const voucherCommissionCodes = voucherCodesWithCommission(vouchers);
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
        commission += orderCommissionSuppressedByVoucher(o, voucherCommissionCodes)
          ? 0
          : p.commission_recognized;
        orderCount += 1;
        if (o.status === "quadro_recebido") completedCount += 1;
      }
      // Vales 100% pagos não convertidos somam à receita
      const voucherRevenue = vouchers
        .filter((v) => inRangeISO(v.created_at, start, end))
        .filter((v) => v.payment_status === "100_pago" && v.usage_status !== "preservacao_agendada")
        .reduce((s, v) => s + Number(v.amount), 0);
      revenueGross += voucherRevenue;
      // Comissões dos vales com parceiro — contam uma única vez no vale, só
      // quando 100% pago (decisão Maria s116). Período = data de criação.
      const voucherCommission = vouchers
        .filter((v) => inRangeISO(v.created_at, start, end))
        .reduce((s, v) => s + commissionFullFromVoucher(v), 0);
      commission += voucherCommission;
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
    return {
      month: aggregate(monthStart, monthEnd),
      prevMonth: aggregate(prevMonthStart, prevMonthEnd),
    };
  }, [orders, vouchers, expenses, monthStart, monthEnd, prevMonthStart, prevMonthEnd]);

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
            Atualizado em {formatDateTimeLisbon(now.toISOString())}
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
    // overflow-x-auto + min-w: scroll horizontal no telemóvel em vez de
    // esmagar as 7 colunas. No PC nada muda.
    <div className="rounded-lg overflow-hidden overflow-x-auto border border-cream-200">
      <table className="w-full min-w-[640px] text-sm">
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

