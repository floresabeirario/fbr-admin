"use client";

// ============================================================
// P&L POR ENCOMENDA — extraído de financas-client.tsx
// ============================================================

import { useMemo, useState } from "react";
import {
  TrendingUp,
  ArrowUpRight,
  CreditCard,
  Calendar as CalendarIcon,
  Frame,
  Handshake,
  Eye,
  EyeOff,
} from "lucide-react";
import { format, parseISO, startOfYear, endOfYear, getYear } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatEUR } from "@/lib/format";
import { orderPnL } from "@/lib/finance";
import { STATUS_LABELS } from "@/types/database";
import { KpiBox, inRangeISO, type FaturacaoOrder } from "./shared";

type PnLSortBy = "event_date" | "client_name" | "budget" | "margin_eur" | "margin_pct" | "paid_ratio";

export function PnLTab({ orders }: { orders: FaturacaoOrder[] }) {
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
  // Esconde encomendas que ainda não têm snapshot de custos. Margem
  // dessas seria 100% por falta de COGS lançado — distorce KPIs.
  const [hideWithoutSnapshot, setHideWithoutSnapshot] = useState(true);

  // Em useMemo próprio: senão as deps do useMemo de inPeriod mudavam em
  // todos os renders (new Date() devolve sempre referência nova).
  const { yearStart, yearEnd } = useMemo(
    () => ({
      yearStart: selectedYear === "all" ? new Date(1970, 0, 1) : startOfYear(new Date(selectedYear as number, 0, 1)),
      yearEnd: selectedYear === "all" ? new Date(2999, 11, 31) : endOfYear(new Date(selectedYear as number, 11, 31)),
    }),
    [selectedYear],
  );

  // Encomendas no período (sem cancelados) — antes do filtro por snapshot.
  // Usado para contar quantas estão escondidas pelo toggle.
  const inPeriod = useMemo(() => {
    return orders
      .filter((o) => o.status !== "cancelado")
      .filter((o) => inRangeISO(o.event_date, yearStart, yearEnd));
  }, [orders, yearStart, yearEnd]);

  const hiddenCount = useMemo(() => {
    return inPeriod.filter((o) => !o.production_cost_snapshot).length;
  }, [inPeriod]);

  const rows = useMemo(() => {
    const filtered = inPeriod
      .filter((o) => (hideWithoutSnapshot ? !!o.production_cost_snapshot : true))
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
  }, [inPeriod, hideWithoutSnapshot, sortBy, sortDir]);

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
      {/* Selector ano + toggle + info */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
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
          {hiddenCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setHideWithoutSnapshot((v) => !v)}
            >
              {hideWithoutSnapshot ? (
                <>
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  Mostrar {hiddenCount} sem custo
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                  Esconder {hiddenCount} sem custo
                </>
              )}
            </Button>
          )}
        </div>
        <p className="text-xs text-cocoa-700 italic">
          {rows.length} {rows.length === 1 ? "encomenda" : "encomendas"}
          {hideWithoutSnapshot && hiddenCount > 0 ? ` (${hiddenCount} escondidas sem COGS)` : " (cancelado excluído)"}
          . Valores plenos (não proporcionais ao %pago). Clica nas colunas para ordenar.
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
        <strong>Margem €</strong> = Preço − COGS − Comissão (valores plenos da encomenda, independentemente do %pago). <strong>COGS</strong> a 0 = encomenda anterior à mig 034 ou sem snapshot. <strong>Comissão</strong> a 0 = sem parceiro ou estado “N/A”/“Não aceita”. Para análise por período (mensal/anual), ver Painel e Faturação.
      </p>
    </div>
  );
}

