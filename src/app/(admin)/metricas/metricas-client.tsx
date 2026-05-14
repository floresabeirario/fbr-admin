"use client";

import { useState, useMemo } from "react";
import {
  LineChart as LineChartIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  RefreshCw,
  Euro,
  CalendarRange,
  ShoppingBag,
  Gift,
  Clock,
  Sparkles,
  Trophy,
  Frame,
  Palette,
  PartyPopper,
  Wifi,
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
  AreaChart,
  Area,
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
import { STATUS_HEX } from "../preservacao/_styles";
import type { OrderStatus } from "@/types/database";

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

// Paletas vivas (mais visíveis) por gráfico circular — cada gráfico tem
// uma família de cores própria para diferenciar visualmente.
const PIE_PALETTE_FRAME = ["#a78bfa", "#818cf8", "#60a5fa", "#38bdf8", "#22d3ee"]; // violeta → ciano
const PIE_PALETTE_BG    = ["#fb7185", "#f472b6", "#e879f9", "#c084fc", "#fbbf24"]; // rosa → amber
const PIE_PALETTE_EVENT = ["#34d399", "#a3e635", "#facc15", "#fb923c", "#fb7185"]; // verde → rosa
const ACQ_PALETTE       = ["#c084fc", "#60a5fa", "#34d399", "#facc15", "#fb923c"];

function formatEuro(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function PctBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
        novo
      </span>
    );
  }
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus;
  const cls =
    pct > 0
      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
      : pct < 0
        ? "bg-rose-100 text-rose-800 border-rose-300"
        : "bg-stone-100 text-stone-700 border-stone-300";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold border",
        cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(pct)}%
    </span>
  );
}

// Card "hero" colorido para os 4 KPIs principais — gradiente suave + ícone
// grande contrastado para a página parecer mais viva.
function HeroKpiCard({
  label,
  value,
  sub,
  pct,
  icon: Icon,
  gradient,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  sub?: string;
  pct?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 space-y-2",
        gradient,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-[#3D2B1F]/70 dark:text-[#E8D5B5]/70">
          {label}
        </div>
        <div
          className={cn(
            "h-9 w-9 shrink-0 rounded-xl flex items-center justify-center shadow-sm",
            iconBg,
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-3xl font-bold text-[#3D2B1F] dark:text-[#E8D5B5] tabular-nums">
          {value}
        </span>
        {pct !== undefined && <PctBadge pct={pct} />}
      </div>
      {sub && (
        <div className="text-[11px] text-[#3D2B1F]/60 dark:text-[#E8D5B5]/60">
          {sub}
        </div>
      )}
    </div>
  );
}

// Card secundário, mais sóbrio mas com um acento de cor no ícone.
function MiniKpi({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E0D5] dark:border-[#2C2C2E] bg-white dark:bg-[#141414] p-5 space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color)} />
        <div className="text-xs uppercase tracking-wider text-[#8B7355] dark:text-[#8E8E93] font-medium">
          {label}
        </div>
      </div>
      <div className="text-xl font-semibold text-[#3D2B1F] dark:text-[#E8D5B5] tabular-nums">
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-[#8B7355] dark:text-[#8E8E93]">{sub}</div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  icon: Icon,
  iconColor,
  children,
  className,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
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
      <h3 className="text-sm font-semibold text-[#3D2B1F] dark:text-[#E8D5B5] flex items-center gap-2">
        {Icon && <Icon className={cn("h-4 w-4", iconColor)} />}
        {title}
      </h3>
      {children}
    </div>
  );
}

interface Props {
  initialOrders: Order[];
  initialVouchers: Voucher[];
  partnerNames: Record<string, string>;
  loadedAt: string;
}

export default function MetricasClient({
  initialOrders,
  initialVouchers,
  partnerNames,
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
      {/* Header com fundo gradiente subtil */}
      <div className="rounded-2xl bg-gradient-to-br from-rose-50 via-amber-50 to-emerald-50 dark:from-rose-950/30 dark:via-amber-950/20 dark:to-emerald-950/30 border border-[#E8E0D5] dark:border-[#2C2C2E] p-4 lg:p-5 flex flex-wrap items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-white/80 dark:bg-[#141414]/80 shadow-sm flex items-center justify-center">
          <LineChartIcon className="h-6 w-6 text-rose-500" />
        </div>
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
            <SelectTrigger className="h-9 min-w-[180px] bg-white dark:bg-[#141414]">
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
            className="bg-white dark:bg-[#141414]"
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
          {/* KPIs hero — cada um com uma cor temática própria */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <HeroKpiCard
              label="Receita do período"
              value={formatEuro(metrics.revenue)}
              pct={metrics.revenuePctChange}
              sub={`vs. período anterior: ${formatEuro(metrics.revenuePrev)}`}
              icon={Euro}
              gradient="bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200 dark:from-emerald-950/40 dark:to-green-900/30 dark:border-emerald-900/50"
              iconBg="bg-emerald-500"
              iconColor="text-white"
            />
            <HeroKpiCard
              label="Receita do ano"
              value={formatEuro(metrics.yearRevenue)}
              pct={metrics.yearRevenuePctChange}
              sub={`vs. ano passado: ${formatEuro(metrics.yearRevenuePrev)}`}
              icon={CalendarRange}
              gradient="bg-gradient-to-br from-sky-50 to-blue-100 border-sky-200 dark:from-sky-950/40 dark:to-blue-900/30 dark:border-sky-900/50"
              iconBg="bg-sky-500"
              iconColor="text-white"
            />
            <HeroKpiCard
              label="Encomendas novas"
              value={String(metrics.newOrders)}
              pct={metrics.newOrdersPctChange}
              sub={`vs. mês anterior: ${metrics.newOrdersPrev}`}
              icon={ShoppingBag}
              gradient="bg-gradient-to-br from-violet-50 to-purple-100 border-violet-200 dark:from-violet-950/40 dark:to-purple-900/30 dark:border-violet-900/50"
              iconBg="bg-violet-500"
              iconColor="text-white"
            />
            <HeroKpiCard
              label="Vales vendidos"
              value={String(metrics.vouchersSold)}
              sub={
                metrics.vouchersConvertedPct !== null
                  ? `${metrics.vouchersConvertedPct}% convertidos em preservação`
                  : "—"
              }
              icon={Gift}
              gradient="bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200 dark:from-amber-950/40 dark:to-orange-900/30 dark:border-amber-900/50"
              iconBg="bg-amber-500"
              iconColor="text-white"
            />
          </div>

          {/* Insights — caixa amarela vibrante */}
          {insights.length > 0 && (
            <div className="rounded-2xl border border-amber-300 dark:border-amber-900/60 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-amber-950/40 p-5 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Insights automáticos
              </div>
              <ul className="space-y-1 text-sm text-amber-900 dark:text-amber-100 list-disc list-inside">
                {insights.map((i, idx) => (
                  <li key={idx}>{i}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Receita mensal — agora gradiente em area chart */}
          <ChartCard
            title="Receita por mês (últimos 12 meses)"
            icon={Euro}
            iconColor="text-emerald-500"
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthly}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D5" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatEuro(Number(v))} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: unknown) => formatEuro(Number(v))}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #E8E0D5",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#revGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Encomendas por estado — barras horizontais agora COM cor por estado */}
          {metrics.ordersByStatus.length > 0 && (
            <ChartCard
              title="Encomendas por estado (no período)"
              icon={Sparkles}
              iconColor="text-violet-500"
            >
              <ResponsiveContainer
                width="100%"
                height={Math.max(220, metrics.ordersByStatus.length * 32)}
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
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #E8E0D5",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {metrics.ordersByStatus.map((row) => (
                      <Cell
                        key={row.status}
                        fill={STATUS_HEX[row.status as OrderStatus]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Distribuições circulares — 3 columns, cada pie com palette própria */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Tamanho de moldura" icon={Frame} iconColor="text-violet-500">
              <PieDist data={metrics.ordersByFrameSize} palette={PIE_PALETTE_FRAME} />
            </ChartCard>
            <ChartCard title="Tipo de fundo" icon={Palette} iconColor="text-rose-500">
              <PieDist data={metrics.ordersByFrameBackground} palette={PIE_PALETTE_BG} />
            </ChartCard>
            <ChartCard title="Tipo de evento" icon={PartyPopper} iconColor="text-emerald-500">
              <PieDist data={metrics.ordersByEventType} palette={PIE_PALETTE_EVENT} />
            </ChartCard>
          </div>

          {/* Tempo médio + Extras + Canal — 3 mini cards com ícone colorido */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <MiniKpi
              icon={Clock}
              color="text-sky-500"
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
            <MiniKpi
              icon={Sparkles}
              color="text-amber-500"
              label="% encomendas com extras"
              value={`${metrics.extrasOrdersPct}%`}
              sub="No período seleccionado"
            />
            <MiniKpi
              icon={Wifi}
              color="text-fuchsia-500"
              label="Canal de aquisição #1"
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

          {/* Top canais de aquisição — barras coloridas */}
          {metrics.topAcquisition.length > 0 && (
            <ChartCard
              title="Top 5 canais de aquisição"
              icon={Wifi}
              iconColor="text-fuchsia-500"
            >
              <ResponsiveContainer width="100%" height={Math.max(160, metrics.topAcquisition.length * 36)}>
                <BarChart
                  data={metrics.topAcquisition}
                  layout="vertical"
                  margin={{ left: 24, right: 24 }}
                >
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #E8E0D5",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {metrics.topAcquisition.map((_, idx) => (
                      <Cell key={idx} fill={ACQ_PALETTE[idx % ACQ_PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          {/* Top parceiros — agora com nomes resolvidos + cor */}
          {metrics.topPartners.length > 0 && (
            <ChartCard
              title="Top 5 parceiros (receita + comissões)"
              icon={Trophy}
              iconColor="text-amber-500"
            >
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-[#8B7355] dark:text-[#8E8E93]">
                  <tr>
                    <th className="text-left py-2">#</th>
                    <th className="text-left py-2">Parceiro</th>
                    <th className="text-right py-2">Receita</th>
                    <th className="text-right py-2">Comissão devida</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.topPartners.map((p, idx) => {
                    const podiumColor =
                      idx === 0
                        ? "text-amber-500"
                        : idx === 1
                          ? "text-stone-500"
                          : idx === 2
                            ? "text-orange-600"
                            : "text-[#8B7355]";
                    const podiumIcon = idx < 3 ? <Trophy className={cn("h-4 w-4", podiumColor)} /> : null;
                    return (
                      <tr
                        key={p.partner_id}
                        className="border-t border-[#F0EAE0] dark:border-[#1F1F1F] hover:bg-[#FAF8F5] dark:hover:bg-[#1A1A1A] transition-colors"
                      >
                        <td className="py-2 w-10">
                          <div className="flex items-center gap-1.5">
                            {podiumIcon}
                            <span className="text-xs font-semibold text-[#8B7355]">
                              {idx + 1}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 text-[#3D2B1F] dark:text-[#E8D5B5] font-medium">
                          <a
                            href={`/parcerias/${p.partner_id}`}
                            className="hover:underline"
                          >
                            {partnerNames[p.partner_id] ?? p.partner_id.slice(0, 8) + "…"}
                          </a>
                        </td>
                        <td className="py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatEuro(p.revenue)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
                          {formatEuro(p.commissions)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}

function PieDist({
  data,
  palette,
}: {
  data: Array<{ label: string; count: number }>;
  palette: string[];
}) {
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
          outerRadius={75}
          innerRadius={32}
          paddingAngle={2}
          label={({ name, value }) => `${name ?? ""} (${value ?? 0})`}
          labelLine={false}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={palette[idx % palette.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #E8E0D5",
            fontSize: 12,
          }}
        />
        <Legend
          verticalAlign="bottom"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
