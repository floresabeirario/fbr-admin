"use client";

// ============================================================
// PAINEL (resumo executivo) — extraído de financas-client.tsx
// ============================================================

import { useMemo, useState } from "react";
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
  Calendar as CalendarIcon,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, getYear } from "date-fns";
import { pt } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTimeLisbon } from "@/lib/format-date";
import { formatEUR } from "@/lib/format";
import {
  orderPnL,
  aggregateExpensesByAccountingType,
  ACCOUNTING_TYPE_LABELS,
  commissionFullFromVoucher,
  voucherCodesWithCommission,
  orderCommissionSuppressedByVoucher,
  expenseAmountInPeriod,
  revenueInPeriod,
  commissionInPeriod,
  cogsInPeriod,
} from "@/lib/finance";
import { monthlyEquivalent } from "@/types/expense";
import { formatDatePT } from "@/lib/format-date";
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
  const currentYear = getYear(now);

  // Período do resumo (pedido da Maria, sessão 174: "escolher o período de
  // tempo, tal como na aba Faturação"). Por defeito o mês actual, como
  // sempre foi; "Mês passado" serve para fechar o mês no início do
  // seguinte; um ano ou "Todos" como na Faturação. A comparação (delta) é
  // sempre com o período homólogo anterior: mês anterior ou ano anterior.
  // O ranking "Onde está o lucro" usa o ano do período escolhido.
  type Period = "this_month" | "last_month" | "all" | number;
  const [period, setPeriod] = useState<Period>("this_month");

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    const add = (iso: string | null) => {
      if (!iso) return;
      try { years.add(getYear(parseISO(iso))); } catch {}
    };
    for (const o of orders) add(o.event_date);
    for (const v of vouchers) add(v.created_at);
    for (const e of expenses) add(e.expense_date);
    return [...years].sort((a, b) => b - a);
  }, [orders, vouchers, expenses, currentYear]);

  // Memoizado para as datas serem estáveis entre renders (antes eram
  // recriadas a cada render e faziam os useMemo abaixo recalcular sempre).
  const range = useMemo(() => {
    if (period === "this_month" || period === "last_month") {
      const base = period === "this_month" ? now : subMonths(now, 1);
      return {
        start: startOfMonth(base),
        end: endOfMonth(base),
        prevStart: startOfMonth(subMonths(base, 1)) as Date | null,
        prevEnd: endOfMonth(subMonths(base, 1)) as Date | null,
        yearStart: startOfYear(base),
        yearEnd: endOfYear(base),
        title: `Resumo de ${format(base, "MMMM 'de' yyyy", { locale: pt })}`,
        unit: "mês" as "mês" | "ano" | "total",
        deltaLabel: "vs. mês anterior",
      };
    }
    if (period === "all") {
      return {
        start: new Date(1970, 0, 1),
        end: new Date(2999, 11, 31),
        prevStart: null as Date | null,
        prevEnd: null as Date | null,
        yearStart: new Date(1970, 0, 1),
        yearEnd: new Date(2999, 11, 31),
        title: "Resumo desde sempre",
        unit: "total" as "mês" | "ano" | "total",
        deltaLabel: "",
      };
    }
    const y = period;
    return {
      start: startOfYear(new Date(y, 0, 1)),
      end: endOfYear(new Date(y, 11, 31)),
      prevStart: startOfYear(new Date(y - 1, 0, 1)) as Date | null,
      prevEnd: endOfYear(new Date(y - 1, 11, 31)) as Date | null,
      yearStart: startOfYear(new Date(y, 0, 1)),
      yearEnd: endOfYear(new Date(y, 11, 31)),
      title: `Resumo de ${y}`,
      unit: "ano" as "mês" | "ano" | "total",
      deltaLabel: "vs. ano anterior",
    };
  }, [period, now]);
  const {
    start: monthStart,
    end: monthEnd,
    prevStart: prevMonthStart,
    prevEnd: prevMonthEnd,
    yearStart,
    yearEnd,
  } = range;
  const rankingYearLabel = period === "all" ? "desde sempre" : String(getYear(yearStart));

  // ── Agregação genérica de um período ──
  // A função vive dentro do useMemo para as deps ficarem completas
  // (react-hooks/exhaustive-deps).
  const { month, prevMonth } = useMemo(() => {
    // Vales que já carregam comissão contada → suprime a comissão das
    // encomendas que vieram desses vales (não recontar; decisão Maria s116).
    const voucherCommissionCodes = voucherCodesWithCommission(vouchers);
    const aggregate = (start: Date, end: Date) => {
      // Dinheiro (receita, custo, comissões): pela DATA DE CADA PAGAMENTO
      // (mig 111; sem carimbo cai na data do evento). Contagens e
      // orçamento médio: pela data do evento, porque são sobre encomendas.
      let revenueGross = 0;
      let cogs = 0;
      let commission = 0;
      for (const o of orders) {
        if (o.status === "cancelado") continue;
        revenueGross += revenueInPeriod(o, start, end);
        cogs += cogsInPeriod(o, start, end);
        commission += orderCommissionSuppressedByVoucher(o, voucherCommissionCodes)
          ? 0
          : commissionInPeriod(o, start, end);
      }
      let orderCount = 0;
      let completedCount = 0;
      let budgetSum = 0;
      for (const o of orders) {
        if (o.status === "cancelado" || !inRangeISO(o.event_date, start, end)) continue;
        orderCount += 1;
        budgetSum += Number(o.budget) || 0;
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
      // Cada despesa entra com o valor que lhe cabe no período: únicas
      // pela data, subscrições ao custo mensal em cada mês activo (antes
      // as subscrições só contavam no mês em que começavam).
      const expensesInRange = expenses
        .map((e) => ({ category: e.category, amount: expenseAmountInPeriod(e, start, end, now) }))
        .filter((e) => e.amount > 0);
      const expensesTotal = expensesInRange.reduce((s, e) => s + e.amount, 0);
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
        budgetSum,
      };
    };
    return {
      month: aggregate(monthStart, monthEnd),
      // "Todos" não tem período anterior: sem delta.
      prevMonth: prevMonthStart && prevMonthEnd ? aggregate(prevMonthStart, prevMonthEnd) : null,
    };
  }, [orders, vouchers, expenses, now, monthStart, monthEnd, prevMonthStart, prevMonthEnd]);

  const revenueDelta = prevMonth && prevMonth.revenueGross > 0
    ? ((month.revenueGross - prevMonth.revenueGross) / prevMonth.revenueGross) * 100
    : null;
  const profitDelta = prevMonth && prevMonth.profit !== 0
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

  // ── Orçamento médio das encomendas com evento no período ──
  // (Antes "ticket médio" = receita ÷ encomendas, que misturava dinheiro
  // por data de pagamento com encomendas por data do evento.)
  const ticketAvg = month.orderCount > 0 ? month.budgetSum / month.orderCount : 0;

  // ── Subscrições que começaram neste período (custos fixos novos) ──
  const newSubs = useMemo(
    () =>
      expenses.filter(
        (e) =>
          e.is_recurring &&
          !!e.recurrence_start_date &&
          inRangeISO(e.recurrence_start_date, monthStart, monthEnd),
      ),
    [expenses, monthStart, monthEnd],
  );

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

  const periodValue = typeof period === "number" ? String(period) : period;

  return (
    <div className="space-y-4">
      {/* Selector de período — o mesmo controlo da Faturação, mais os dois meses */}
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarIcon className="h-4 w-4 text-cocoa-700" />
        <span className="text-sm font-medium text-cocoa-900">Período:</span>
        <Select
          value={periodValue}
          onValueChange={(v) =>
            setPeriod(v === "this_month" || v === "last_month" || v === "all" ? v : Number(v))
          }
        >
          <SelectTrigger className="h-9 w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">Este mês</SelectItem>
            <SelectItem value="last_month">Mês passado</SelectItem>
            <SelectItem value="all">Todos (desde sempre)</SelectItem>
            {availableYears.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}{y === currentYear ? " (actual)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 dark:border-emerald-900/50 p-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-200 first-letter:capitalize">
            {range.title}
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
          deltaLabel={range.deltaLabel}
          subLabel="Bruta"
          subValue={month.commission > 0 ? formatEUR(month.revenueGross) : undefined}
        />
        <KpiBox label="Custo de produção" value={formatEUR(month.cogs)} icon={<Frame className="h-4 w-4" />} color="amber" />
        <KpiBox label="Comissões" value={formatEUR(month.commission)} icon={<Handshake className="h-4 w-4" />} color="violet" />
        <KpiBox label="Despesas" value={formatEUR(month.expensesTotal)} icon={<Receipt className="h-4 w-4" />} color="rose" />
        <KpiBox
          label="Lucro líquido"
          value={formatEUR(month.profit)}
          icon={<CreditCard className="h-4 w-4" />}
          color={month.profit >= 0 ? "emerald" : "rose"}
          delta={profitDelta}
          deltaLabel={range.deltaLabel}
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
          label={range.unit === "mês" ? "Eventos no mês" : range.unit === "ano" ? "Eventos no ano" : "Eventos (total)"}
          value={String(month.orderCount)}
          icon={<Package className="h-4 w-4" />}
          color="sky"
          subLabel="Concluídas"
          subValue={month.completedCount > 0 ? String(month.completedCount) : undefined}
        />
        <KpiBox label="Orçamento médio" value={formatEUR(ticketAvg)} icon={<Tags className="h-4 w-4" />} color="sky" />
        <KpiBox
          label={`Quadro mais lucrativo (${range.unit === "total" ? "sempre" : range.unit})`}
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
          {range.unit === "mês" ? "Despesas do mês por tipo" : range.unit === "ano" ? "Despesas do ano por tipo" : "Despesas por tipo (desde sempre)"}
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

      {/* Subscrições novas no período — custos fixos que entraram (sessão 174) */}
      {newSubs.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/50 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Subscrições que começaram neste período ({newSubs.length})
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {newSubs.map((e) => (
                <tr key={e.id} className="border-t border-amber-100 dark:border-amber-900/30 first:border-t-0">
                  <td className="py-1 text-cocoa-900">{e.description}</td>
                  <td className="py-1 text-xs text-cocoa-700">desde {formatDatePT(e.recurrence_start_date)}</td>
                  <td className="py-1 text-right tabular-nums text-cocoa-900 w-32">{formatEUR(monthlyEquivalent(e))} /mês</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
            Custos fixos novos: confirma que são mesmo para ficar.
          </p>
        </div>
      )}

      {/* Ranking — Onde está o lucro (ano corrente) */}
      <div className="rounded-xl border border-cream-200 bg-surface p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold text-cocoa-900">
            Onde está o lucro — {rankingYearLabel}
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
            <th className="text-right px-3 py-2 font-medium w-24">Custo prod.</th>
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

