"use client";

import { useState, useMemo } from "react";
import {
  LineChart as LineChartIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  RefreshCw,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import {
  computeMetrics,
  generateInsights,
  monthlyRevenue,
  rangeFromPreset,
  RANGE_PRESET_LABELS,
  type RangePreset,
  type DateRange,
} from "@/lib/metrics";

const PIE_COLORS = [
  "#C4A882",
  "#8B7355",
  "#3D2B1F",
  "#E8D5B5",
  "#A07355",
  "#D4B896",
  "#6B5645",
  "#F0DCC4",
];

function formatEuro(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function PctBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-xs font-semibold text-emerald-700">novo</span>;
  }
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const color =
    pct > 0
      ? "text-emerald-600"
      : pct < 0
        ? "text-rose-600"
        : "text-[#8B7355]";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", color)}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  sub,
  pct,
}: {
  label: string;
  value: string;
  sub?: string;
  pct?: number | null;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E0D5] dark:border-[#2C2C2E] bg-white dark:bg-[#141414] p-5 space-y-1.5">
      <div className="text-xs uppercase tracking-wider text-[#8B7355] dark:text-[#8E8E93] font-medium">
        {label}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl font-semibold text-[#3D2B1F] dark:text-[#E8D5B5]">
          {value}
        </span>
        {pct !== undefined && <PctBadge pct={pct} />}
      </div>
      {sub && (
        <div className="text-xs text-[#8B7355] dark:text-[#8E8E93]">{sub}</div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[#E8E0D5] dark:border-[#2C2C2E] bg-white dark:bg-[#141414] p-5 space-y-3",
        className,
      )}
    >
      <h3 className="text-sm font-semibold text-[#3D2B1F] dark:text-[#E8D5B5]">
        {title}
      </h3>
      {children}
    </div>
  );
}

interface Props {
  initialOrders: Order[];
  initialVouchers: Voucher[];
  loadedAt: string;
}

export default function MetricasClient({
  initialOrders,
  initialVouchers,
  loadedAt,
}: Props) {
  const [preset, setPreset] = useState<RangePreset>("este_mes");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const range: DateRange | null = useMemo(() => {
    if (preset === "personalizado") {
      if (!customStart || !customEnd) return null;
      try {
        return { start: parseISO(customStart), end: parseISO(customEnd) };
      } catch {
        return null;
      }
    }
    return rangeFromPreset(preset);
  }, [preset, customStart, customEnd]);

  const metrics = useMemo(
    () => (range ? computeMetrics(initialOrders, initialVouchers, range) : null),
    [range, initialOrders, initialVouchers],
  );

  const insights = useMemo(() => (metrics ? generateInsights(metrics) : []), [metrics]);

  const monthly = useMemo(
    () => monthlyRevenue(initialOrders, initialVouchers, 12),
    [initialOrders, initialVouchers],
  );

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <LineChartIcon className="h-6 w-6 text-[#C4A882]" />
        <div>
          <h1 className="text-2xl font-semibold text-[#3D2B1F] dark:text-[#E8D5B5]">
            Métricas
          </h1>
          <p className="text-sm text-[#8B7355] dark:text-[#8E8E93]">
            Última actualização: {format(parseISO(loadedAt), "dd/MM/yyyy, HH:mm", { locale: pt })}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Select value={preset} onValueChange={(v) => v && setPreset(v as RangePreset)}>
            <SelectTrigger className="h-9 min-w-[180px]">
              <SelectValue labels={RANGE_PRESET_LABELS} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RANGE_PRESET_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}
            title="Actualizar dados"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Actualizar
          </Button>
        </div>
      </div>

      {preset === "personalizado" && (
        <div className="flex items-center gap-3 bg-[#FAF8F5] dark:bg-[#1A1A1A] border border-[#E8E0D5] dark:border-[#2C2C2E] rounded-xl p-3">
          <span className="text-xs text-[#8B7355] dark:text-[#8E8E93]">
            Período personalizado:
          </span>
          <Input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="h-8 w-auto text-xs"
          />
          <span className="text-xs text-[#8B7355]">→</span>
          <Input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="h-8 w-auto text-xs"
          />
        </div>
      )}

      {!metrics && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-6 text-sm text-amber-900 dark:text-amber-200">
          Escolhe duas datas válidas para ver as métricas personalizadas.
        </div>
      )}

      {metrics && (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Receita do período"
              value={formatEuro(metrics.revenue)}
              pct={metrics.revenuePctChange}
              sub={`vs. período anterior: ${formatEuro(metrics.revenuePrev)}`}
            />
            <KpiCard
              label="Receita do ano"
              value={formatEuro(metrics.yearRevenue)}
              pct={metrics.yearRevenuePctChange}
              sub={`vs. ano passado: ${formatEuro(metrics.yearRevenuePrev)}`}
            />
            <KpiCard
              label="Encomendas novas"
              value={String(metrics.newOrders)}
              pct={metrics.newOrdersPctChange}
              sub={`vs. mês anterior: ${metrics.newOrdersPrev}`}
            />
            <KpiCard
              label="Vales vendidos"
              value={String(metrics.vouchersSold)}
              sub={
                metrics.vouchersConvertedPct !== null
                  ? `${metrics.vouchersConvertedPct}% convertidos em preservação`
                  : "—"
              }
            />
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <div className="rounded-2xl border border-[#E8E0D5] dark:border-[#2C2C2E] bg-gradient-to-br from-[#FAF8F5] to-white dark:from-[#1A1A1A] dark:to-[#141414] p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#3D2B1F] dark:text-[#E8D5B5]">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Insights automáticos
              </div>
              <ul className="space-y-1 text-sm text-[#3D2B1F] dark:text-[#E8D5B5] list-disc list-inside">
                {insights.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Receita mensal — gráfico de linha */}
          <ChartCard title="Receita por mês (últimos 12 meses)">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D5" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatEuro(Number(v))} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown) => formatEuro(Number(v))} />
                <Line type="monotone" dataKey="revenue" stroke="#C4A882" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Encomendas por estado — barras horizontais */}
          {metrics.ordersByStatus.length > 0 && (
            <ChartCard title="Encomendas por estado (no período)">
              <ResponsiveContainer
                width="100%"
                height={Math.max(220, metrics.ordersByStatus.length * 28)}
              >
                <BarChart
                  data={metrics.ordersByStatus}
                  layout="vertical"
                  margin={{ left: 24, right: 24 }}
                >
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={180}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#C4A882" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Distribuições circulares — 3 columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Tamanho de moldura">
              <PieDist data={metrics.ordersByFrameSize} />
            </ChartCard>
            <ChartCard title="Tipo de fundo">
              <PieDist data={metrics.ordersByFrameBackground} />
            </ChartCard>
            <ChartCard title="Tipo de evento">
              <PieDist data={metrics.ordersByEventType} />
            </ChartCard>
          </div>

          {/* Tempo médio + Extras */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <KpiCard
              label="Tempo médio de conclusão"
              value={
                metrics.avgCompletionGlobal !== null
                  ? `${metrics.avgCompletionGlobal} dias`
                  : "—"
              }
              sub={
                metrics.avgCompletionRecent !== null
                  ? `Últimos 6 meses: ${metrics.avgCompletionRecent} dias`
                  : undefined
              }
            />
            <KpiCard
              label="% encomendas com extras"
              value={`${metrics.extrasOrdersPct}%`}
              sub="No período seleccionado"
            />
            <KpiCard
              label="Top canais de aquisição"
              value={
                metrics.topAcquisition.length > 0
                  ? metrics.topAcquisition[0].label
                  : "—"
              }
              sub={metrics.topAcquisition
                .slice(0, 3)
                .map((a) => `${a.label} (${a.count})`)
                .join(" · ")}
            />
          </div>

          {/* Top parceiros */}
          {metrics.topPartners.length > 0 && (
            <ChartCard title="Top 5 parceiros (receita + comissões)">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-[#8B7355] dark:text-[#8E8E93]">
                  <tr>
                    <th className="text-left py-2">Parceiro</th>
                    <th className="text-right py-2">Receita</th>
                    <th className="text-right py-2">Comissão devida</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topPartners.map((p) => (
                    <tr
                      key={p.partner_id}
                      className="border-t border-[#F0EAE0] dark:border-[#1F1F1F]"
                    >
                      <td className="py-2 text-[#3D2B1F] dark:text-[#E8D5B5] font-mono text-xs">
                        {p.partner_id.slice(0, 8)}…
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatEuro(p.revenue)}</td>
                      <td className="py-2 text-right tabular-nums">{formatEuro(p.commissions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-[#8B7355] dark:text-[#8E8E93] italic">
                Os nomes dos parceiros vão aparecer quando a aba Parcerias estiver pronta (Fase 5).
              </p>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}

function PieDist({ data }: { data: Array<{ label: string; count: number }> }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-[#8B7355] dark:text-[#8E8E93] py-12 text-center">
        Sem dados no período.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="50%"
          outerRadius={70}
          label={({ name, value }) => `${name ?? ""} (${value ?? 0})`}
          labelLine={false}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend
          verticalAlign="bottom"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
