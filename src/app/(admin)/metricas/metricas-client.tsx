"use client";

// ============================================================
// MÉTRICAS — pedidos, conversão, operação e rede.
// Reestruturada na sessão 174 ("vai tudo"): 4 secções com título, filtro
// por tipo de serviço, uma só lógica de cor, distribuições em barras (os
// círculos não se liam), pedidos por mês, sazonalidade, antecedência,
// cancelamentos, dias por fase (mig 113), resposta no WhatsApp (mig 113),
// clientes repetidos e cidades. O dinheiro vive nas Finanças.
// ============================================================

import React, { useState, useMemo } from "react";
import { useTheme } from "next-themes";
import {
  LineChart as LineChartIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  RefreshCw,
  ShoppingBag,
  Gift,
  Clock,
  Sparkles,
  Trophy,
  Frame,
  Palette,
  PartyPopper,
  Wifi,
  Car,
  Package,
  MessageCircle,
  Ticket,
  Sparkle,
  Info,
  Filter,
  CalendarClock,
  Ban,
  Timer,
  Users,
  MapPin,
  Layers,
  CalendarDays,
  Wrench,
} from "lucide-react";
import { parseISO } from "date-fns";
import Link from "next/link";
import { formatDateTimeLisbon, formatDatePT } from "@/lib/format-date";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  CartesianGrid,
  LabelList,
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
import { formatEUR } from "@/lib/format";
import { STATUS_HEX } from "../preservacao/_styles";
import type {
  OrderStatus,
  FlowerDeliveryMethod,
  FrameDeliveryMethod,
  ContactPreference,
  CouponStatus,
  FrameBackground,
  FrameSize,
  EventType,
  ServiceType,
} from "@/types/database";
import { SERVICE_TYPE_LABELS } from "@/types/database";
import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import {
  computeMetrics,
  generateInsights,
  rangeFromPreset,
  RANGE_PRESET_LABELS,
  type RangePreset,
  type DateRange,
  type StatusHistoryRow,
  type ResponseTimeRow,
} from "@/lib/metrics";

// ── Paleta ───────────────────────────────────────────────────
// Uma só lógica de cor em toda a página: verde = confirmado/bom, rosa =
// cancelado/risco, âmbar = à espera/atenção, azul = neutro, cinza = sem
// resposta. As distribuições de produto usam a paleta categórica; os
// estados de produção mantêm as cores dos badges da Preservação
// (STATUS_HEX) para "Flores na prensa" ter a mesma cor em todo o lado.
const OK = "#10b981";
const RISK = "#f43f5e";
const WAIT = "#f59e0b";
const NEUTRAL = "#0ea5e9";
const MUTED = "#a8a29e";
const CAT_PALETTE = ["#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#14b8a6", "#d946ef", "#a3a3a3"];
const YEAR_PALETTE = ["#a8a29e", "#0ea5e9", "#8b5cf6"];

// Cores "naturais" por categoria — o preto é escuro, o transparente é
// claro, o CTT é azul onde quer que apareça.
const FRAME_BACKGROUND_HEX: Record<FrameBackground, string> = {
  transparente: "#cbd5e1",
  preto: "#374151",
  branco: "#e5e7eb",
  fotografia: "#3b82f6",
  cor: "#d946ef",
  voces_a_escolher: "#94a3b8",
  nao_sei: MUTED,
};
const FRAME_SIZE_HEX: Record<FrameSize, string> = {
  "30x40": "#D4C19F",
  "40x50": "#C4A882",
  "50x70": "#9C7B4E",
  voces_a_escolher: "#94a3b8",
  nao_sei: MUTED,
};
const EVENT_TYPE_HEX: Record<EventType, string> = {
  casamento: "#f472b6",
  batizado: "#60a5fa",
  funeral: "#64748b",
  pedido_casamento: "#fb7185",
  outro: MUTED,
};
const FLOWER_DELIVERY_HEX: Record<FlowerDeliveryMethod, string> = {
  maos: OK,
  ctt: NEUTRAL,
  recolha_evento: "#8b5cf6",
  nao_sei: MUTED,
};
const FRAME_DELIVERY_HEX: Record<FrameDeliveryMethod, string> = {
  maos: OK,
  ctt: NEUTRAL,
  nao_sei: MUTED,
};
const CONTACT_PREF_HEX: Record<ContactPreference, string> = {
  whatsapp: OK,
  email: NEUTRAL,
};
const COUPON_STATUS_HEX: Record<CouponStatus, string> = {
  utilizado: OK,
  nao_utilizado: WAIT,
  na: MUTED,
};
// Antecedência: do "depois do evento" (risco) até "mais de 6 meses antes".
const LEAD_PALETTE = [RISK, WAIT, "#eab308", NEUTRAL, OK, "#8b5cf6"];

const formatEuro = (value: number): string => formatEUR(value, { rounded: true });

// ── Componentes de apresentação ──────────────────────────────

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
    <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold border", cls)}>
      <Icon className="h-3 w-3" />
      {Math.abs(pct)}%
    </span>
  );
}

function HeroKpiCard({
  label,
  value,
  sub,
  pct,
  icon: Icon,
  gradient,
  iconBg,
  iconColor,
  info,
}: {
  label: string;
  value: string;
  sub?: string;
  pct?: number | null;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  iconBg: string;
  iconColor: string;
  info?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border p-5 space-y-2", gradient)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold text-cocoa-900/70 dark:text-[#E8D5B5]/70">
          {label}
          {info && (
            <span title={info} className="cursor-help inline-flex">
              <Info className="h-3 w-3 opacity-60" />
            </span>
          )}
        </div>
        <div className={cn("h-9 w-9 shrink-0 rounded-xl flex items-center justify-center shadow-sm", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-3xl font-bold text-cocoa-900 tabular-nums">{value}</span>
        {pct !== undefined && <PctBadge pct={pct} />}
      </div>
      {sub && <div className="text-[11px] text-cocoa-900/60 dark:text-[#E8D5B5]/60">{sub}</div>}
    </div>
  );
}

function MiniKpi({
  label,
  value,
  sub,
  icon: Icon,
  color,
  info,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  info?: string;
}) {
  return (
    <div className="rounded-2xl border border-cream-200 bg-surface p-5 space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color)} />
        <div className="text-xs uppercase tracking-wider text-cocoa-700 font-medium flex items-center gap-1">
          {label}
          {info && (
            <span title={info} className="cursor-help inline-flex text-cocoa-500">
              <Info className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
      <div className="text-xl font-semibold text-cocoa-900 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-cocoa-700">{sub}</div>}
    </div>
  );
}

function ChartCard({
  title,
  icon: Icon,
  iconColor,
  children,
  className,
  info,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  children: React.ReactNode;
  className?: string;
  info?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-cream-200 bg-surface p-5 space-y-3", className)}>
      <h3 className="text-sm font-semibold text-cocoa-900 flex items-center gap-2">
        {Icon && <Icon className={cn("h-4 w-4", iconColor)} />}
        {title}
        {info && (
          <span title={info} className="cursor-help inline-flex text-cocoa-500">
            <Info className="h-3.5 w-3.5" />
          </span>
        )}
      </h3>
      {children}
    </div>
  );
}

// Título de secção: divide a página em 4 blocos legíveis.
function Section({
  title,
  sub,
  icon: Icon,
  children,
}: {
  title: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3 flex-wrap pt-2">
        <h2 className="text-lg font-semibold text-cocoa-900 flex items-center gap-2">
          <Icon className="h-5 w-5 text-cocoa-700" />
          {title}
        </h2>
        {sub && <p className="text-xs text-cocoa-700">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

// Distribuição em barras horizontais com contagem e %. Substitui os
// gráficos circulares (com 5 fatias parecidas não se liam).
function DistBars({
  data,
  fills,
  emptyText = "Sem dados no período.",
}: {
  data: Array<{ label: string; count: number }>;
  fills?: string[];
  emptyText?: string;
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <p className="text-sm text-cocoa-700 py-6 text-center italic">{emptyText}</p>;
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const pct = Math.round((d.count / total) * 100);
        return (
          <div key={d.label}>
            <div className="flex items-baseline justify-between gap-2 text-xs mb-1">
              <span className="truncate text-cocoa-900">{d.label}</span>
              <span className="tabular-nums text-cocoa-700 shrink-0">
                {d.count} · {pct}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-cream-100 dark:bg-[#322821]">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${(d.count / max) * 100}%`, background: fills?.[i] ?? CAT_PALETTE[i % CAT_PALETTE.length] }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FunnelTable({
  rows,
  first,
  totalRow,
}: {
  rows: Array<{ key: string; label: string; total: number; confirmed: number; confirmedPct: number | null; cancelled?: number }>;
  first: string;
  totalRow?: { total: number; confirmed: number; confirmedPct: number | null; cancelled: number };
}) {
  const showCancelled = rows.some((r) => r.cancelled !== undefined);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[360px] text-sm">
        <thead className="text-xs uppercase tracking-wider text-cocoa-700">
          <tr>
            <th className="text-left py-2">{first}</th>
            <th className="text-right py-2">Pedidos</th>
            <th className="text-right py-2">Com sinal</th>
            <th className="text-right py-2">Taxa</th>
            {showCancelled && <th className="text-right py-2">Cancelados</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={showCancelled ? 5 : 4} className="py-3 text-center text-cocoa-700 italic">
                Sem pedidos no período.
              </td>
            </tr>
          )}
          {rows.map((c) => (
            <tr key={c.key} className="border-t border-cream-100">
              <td className="py-2 text-cocoa-900">{c.label}</td>
              <td className="py-2 text-right tabular-nums text-cocoa-900">{c.total}</td>
              <td className="py-2 text-right tabular-nums text-emerald-700">{c.confirmed}</td>
              <td
                className={cn(
                  "py-2 text-right tabular-nums font-semibold",
                  (c.confirmedPct ?? 0) >= 50 ? "text-emerald-700" : (c.confirmedPct ?? 0) >= 30 ? "text-amber-700" : "text-rose-700",
                )}
              >
                {c.confirmedPct !== null ? `${c.confirmedPct}%` : "—"}
              </td>
              {showCancelled && <td className="py-2 text-right tabular-nums text-rose-700">{c.cancelled}</td>}
            </tr>
          ))}
          {totalRow && rows.length > 1 && (
            <tr className="border-t-2 border-cream-300 font-semibold">
              <td className="py-2 text-cocoa-900">Total</td>
              <td className="py-2 text-right tabular-nums text-cocoa-900">{totalRow.total}</td>
              <td className="py-2 text-right tabular-nums text-emerald-700">{totalRow.confirmed}</td>
              <td className="py-2 text-right tabular-nums text-cocoa-900">
                {totalRow.confirmedPct !== null ? `${totalRow.confirmedPct}%` : "—"}
              </td>
              {showCancelled && <td className="py-2 text-right tabular-nums text-rose-700">{totalRow.cancelled}</td>}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Barra empilhada horizontal — uma linha por upsell, "Sim" + "Mais info".
function UpsellsBars({
  data,
  tooltipStyle,
  chartGrid,
}: {
  data: Array<{ label: string; sim: number; maisInfo: number }>;
  tooltipStyle: React.CSSProperties;
  chartGrid: string;
}) {
  const hasAny = data.some((d) => d.sim + d.maisInfo > 0);
  if (!hasAny) {
    return <p className="text-sm text-cocoa-700 py-6 text-center italic">Sem dados de upsells no período.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 50)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24, right: 32 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        {/* Lado a lado, pela mesma razão do gráfico mensal: empilhado lia-se mal. */}
        <Bar dataKey="sim" name="Sim" fill={OK} radius={[0, 6, 6, 0]}>
          <LabelList dataKey="sim" position="right" style={{ fontSize: 10 }} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")} />
        </Bar>
        <Bar dataKey="maisInfo" name="Mais info" fill={WAIT} radius={[0, 6, 6, 0]}>
          <LabelList dataKey="maisInfo" position="right" style={{ fontSize: 10 }} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Página ───────────────────────────────────────────────────

interface Props {
  initialOrders: Order[];
  initialVouchers: Voucher[];
  partnerNames: Record<string, string>;
  statusHistory: StatusHistoryRow[];
  responseTimes: ResponseTimeRow[];
  loadedAt: string;
}

type ServiceFilter = "todos" | ServiceType;

export default function MetricasClient({
  initialOrders,
  initialVouchers,
  partnerNames,
  statusHistory,
  responseTimes,
  loadedAt,
}: Props) {
  // "Desde sempre" por defeito — decisão da Maria (sessão 174), não mudar.
  const [preset, setPreset] = useState<RangePreset>("desde_sempre");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [service, setService] = useState<ServiceFilter>("todos");

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const chartGrid = isDark ? "#322821" : "#E8E0D5";
  const tooltipStyle = {
    borderRadius: 8,
    border: `1px solid ${isDark ? "#322821" : "#E8E0D5"}`,
    background: isDark ? "#1B1611" : "#FFFFFF",
    color: isDark ? "#E8D5B5" : "#3D2B1F",
    fontSize: 12,
  } as const;
  const axisTick = { fontSize: 11, fill: isDark ? "#E8D5B5" : "#3D2B1F" } as const;

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

  // Filtro por tipo de serviço: aplica-se às encomendas (os vales não têm
  // serviço). As encomendas antigas sem service_type são preservação.
  const orders = useMemo(
    () =>
      service === "todos"
        ? initialOrders
        : initialOrders.filter((o) => (o.service_type ?? "preservacao") === service),
    [initialOrders, service],
  );

  const metrics = useMemo(
    () =>
      range
        ? computeMetrics(orders, initialVouchers, range, new Date(), preset, { statusHistory, responseTimes })
        : null,
    [range, orders, initialVouchers, preset, statusHistory, responseTimes],
  );

  const insights = useMemo(
    () => (metrics ? generateInsights(metrics, partnerNames) : []),
    [metrics, partnerNames],
  );

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-rose-50 via-amber-50 to-emerald-50 dark:from-rose-950/30 dark:via-amber-950/20 dark:to-emerald-950/30 border border-cream-200 p-4 lg:p-5 flex flex-wrap items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-surface/80 shadow-sm flex items-center justify-center">
          <LineChartIcon className="h-6 w-6 text-rose-500" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-cocoa-900">Métricas</h1>
          <p className="text-sm text-cocoa-700">Última actualização: {formatDateTimeLisbon(loadedAt)}</p>
          <p className="text-xs text-cocoa-700">
            Receita, custos e lucro vivem nas{" "}
            <Link href="/financas" className="underline underline-offset-2 hover:text-cocoa-900">
              Finanças
            </Link>
            . Aqui: pedidos, conversão, operação e rede.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Select value={preset} onValueChange={(v) => v && setPreset(v as RangePreset)}>
            <SelectTrigger className="h-9 min-w-[180px] bg-surface">
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
          <Select value={service} onValueChange={(v) => setService((v as ServiceFilter) ?? "todos")}>
            <SelectTrigger className="h-9 min-w-[200px] bg-surface">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os serviços</SelectItem>
              {(Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SERVICE_TYPE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="bg-surface" onClick={() => window.location.reload()} title="Actualizar dados">
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Actualizar
          </Button>
        </div>
      </div>

      {preset === "personalizado" && (
        <div className="flex items-center gap-3 bg-cream-50 border border-cream-200 rounded-xl p-3">
          <span className="text-xs text-cocoa-700">Período personalizado:</span>
          <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-8 w-auto text-xs" />
          <span className="text-xs text-cocoa-700">→</span>
          <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-8 w-auto text-xs" />
        </div>
      )}

      {!metrics && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 p-6 text-sm text-amber-900 dark:text-amber-200">
          Escolhe duas datas válidas para ver as métricas personalizadas.
        </div>
      )}

      {metrics && (
        <>
          {/* Insights */}
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

          {/* ═══════════ 1. PROCURA E CONVERSÃO ═══════════ */}
          <Section title="Procura e conversão" icon={Filter} sub="Pedidos criados no período, pela data do pedido">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <HeroKpiCard
                label="Pedidos novos"
                value={String(metrics.newOrders)}
                pct={metrics.showComparison ? metrics.newOrdersPctChange : undefined}
                sub={metrics.showComparison ? `vs. ${metrics.comparisonLabel}: ${metrics.newOrdersPrev}` : "Todos os pedidos (data de criação)"}
                icon={ShoppingBag}
                gradient="bg-gradient-to-br from-violet-50 to-purple-100 border-violet-200 dark:from-violet-950/40 dark:to-purple-900/30 dark:border-violet-900/50"
                iconBg="bg-violet-500"
                iconColor="text-white"
              />
              <HeroKpiCard
                label="Taxa de confirmação"
                value={metrics.funnel.confirmedPct !== null ? `${metrics.funnel.confirmedPct}%` : "—"}
                info="Dos pedidos criados no período, quantos já pagaram o sinal (30% ou mais), mesmo que tenham cancelado depois. 'À espera' = ainda sem sinal e não cancelados."
                sub={
                  metrics.funnel.confirmedPctPrev !== null
                    ? `vs. ${metrics.comparisonLabel}: ${metrics.funnel.confirmedPctPrev}% · ${metrics.funnel.pending} à espera`
                    : `${metrics.funnel.confirmed} com sinal · ${metrics.funnel.pending} à espera`
                }
                icon={Filter}
                gradient="bg-gradient-to-br from-emerald-50 to-green-100 border-emerald-200 dark:from-emerald-950/40 dark:to-green-900/30 dark:border-emerald-900/50"
                iconBg="bg-emerald-500"
                iconColor="text-white"
              />
              <HeroKpiCard
                label="Cancelamentos"
                value={String(metrics.cancellations.count)}
                info="Pedidos criados no período que estão cancelados. A fase em que estavam é registada desde a mig 111; os antigos aparecem como 'Sem registo'."
                sub={metrics.cancellations.pct !== null ? `${metrics.cancellations.pct}% dos pedidos do período` : "Sem pedidos no período"}
                icon={Ban}
                gradient="bg-gradient-to-br from-rose-50 to-red-100 border-rose-200 dark:from-rose-950/40 dark:to-red-900/30 dark:border-rose-900/50"
                iconBg="bg-rose-500"
                iconColor="text-white"
              />
              <HeroKpiCard
                label="Vales vendidos"
                value={String(metrics.vouchersSold)}
                sub={metrics.vouchersConvertedPct !== null ? `${metrics.vouchersConvertedPct}% convertidos em preservação` : "—"}
                icon={Gift}
                gradient="bg-gradient-to-br from-amber-50 to-orange-100 border-amber-200 dark:from-amber-950/40 dark:to-orange-900/30 dark:border-amber-900/50"
                iconBg="bg-amber-500"
                iconColor="text-white"
              />
            </div>

            {/* Pedidos por mês — barras LADO A LADO com o número em cima.
                Empilhadas liam-se mal: o topo da cor de cima parecia o
                valor dessa cor (a Maria leu "28 cancelados" onde eram 5). */}
            <ChartCard
              title="Pedidos por mês (últimos 12 meses)"
              icon={ShoppingBag}
              iconColor="text-violet-500"
              info="Pedidos criados em cada mês, desde que o formulário público existe (as encomendas importadas do Monday têm a data de criação errada e ficam de fora). Cada barra é o número de pedidos desse mês nesse estado: verde = pagaram sinal; âmbar = à espera; rosa = cancelaram sem sinal. Não depende do período escolhido."
            >
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={metrics.monthlyRequests} barCategoryGap="20%" barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                  <XAxis dataKey="label" tick={axisTick} />
                  <YAxis allowDecimals={false} tick={axisTick} width={32} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: chartGrid, opacity: 0.4 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="confirmed" name="Com sinal" fill={OK} radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="confirmed" position="top" style={{ fontSize: 10, fill: axisTick.fill }} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")} />
                  </Bar>
                  <Bar dataKey="pending" name="À espera" fill={WAIT} radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="pending" position="top" style={{ fontSize: 10, fill: axisTick.fill }} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")} />
                  </Bar>
                  <Bar dataKey="cancelled" name="Cancelados" fill={RISK} radius={[3, 3, 0, 0]}>
                    <LabelList dataKey="cancelled" position="top" style={{ fontSize: 10, fill: axisTick.fill }} formatter={(v: unknown) => (Number(v) > 0 ? String(v) : "")} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Funil por canal / idioma / serviço */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
              <ChartCard
                title="Funil pedido → sinal, por canal"
                icon={Filter}
                iconColor="text-emerald-500"
                info="Pedidos criados no período e quantos pagaram o sinal, por canal de aquisição. 'Sem resposta' = o cliente não disse como conheceu a FBR."
              >
                <FunnelTable rows={metrics.funnel.byChannel} first="Canal" totalRow={metrics.funnel} />
              </ChartCard>
              <div className="space-y-4">
                <MiniKpi
                  icon={Timer}
                  color="text-sky-500"
                  label="Tempo até ao sinal (mediana)"
                  value={metrics.funnel.medianDaysToDeposit !== null ? `${metrics.funnel.medianDaysToDeposit} dias` : "—"}
                  sub={
                    metrics.funnel.depositSample > 0
                      ? `${metrics.funnel.depositSample} pedido${metrics.funnel.depositSample === 1 ? "" : "s"} com data de pagamento`
                      : "Sem datas de pagamento no período"
                  }
                />
                <ChartCard title="Por idioma" icon={MessageCircle} iconColor="text-sky-500">
                  <FunnelTable rows={metrics.funnel.byLanguage} first="Idioma" />
                </ChartCard>
                <ChartCard title="Por serviço" icon={Wrench} iconColor="text-violet-500">
                  <FunnelTable rows={metrics.funnel.byService} first="Serviço" />
                </ChartCard>
              </div>
            </div>

            {/* Antecedência */}
            <ChartCard
              title="Com que antecedência reservam? (preservação)"
              icon={CalendarClock}
              iconColor="text-violet-500"
              info="Dias entre o pedido e a data do evento, só nas encomendas de preservação (nas flores secas e na recriação o evento é sempre no passado). 'Depois do evento' = o pedido chegou depois do casamento. Só pedidos desde que o formulário público existe."
            >
              {metrics.leadTime.sample === 0 ? (
                <p className="text-sm text-cocoa-700 italic">Sem pedidos de preservação com data de evento neste período.</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-start">
                  <div className="space-y-3">
                    <MiniKpi
                      icon={CalendarClock}
                      color="text-rose-500"
                      label="Chegam depois do evento"
                      value={metrics.leadTime.afterEventPct !== null ? `${metrics.leadTime.afterEventPct}%` : "—"}
                      sub={`${metrics.leadTime.buckets.find((b) => b.key === "depois")?.count ?? 0} de ${metrics.leadTime.sample} pedidos`}
                    />
                    <MiniKpi
                      icon={Timer}
                      color="text-violet-500"
                      label="Antecedência mediana"
                      value={
                        metrics.leadTime.medianDays === null
                          ? "—"
                          : metrics.leadTime.medianDays < 0
                            ? `${Math.abs(metrics.leadTime.medianDays)} dias depois`
                            : `${metrics.leadTime.medianDays} dias antes`
                      }
                      sub={metrics.leadTime.since ? `Pedidos desde ${formatDatePT(metrics.leadTime.since.slice(0, 10))}` : undefined}
                    />
                  </div>
                  <ResponsiveContainer width="100%" height={Math.max(200, metrics.leadTime.buckets.length * 36)}>
                    <BarChart data={metrics.leadTime.buckets} layout="vertical" margin={{ left: 24, right: 40 }}>
                      <XAxis type="number" allowDecimals={false} tick={axisTick} />
                      <YAxis type="category" dataKey="label" width={170} tick={axisTick} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: unknown, _n, item) => [`${v} (${(item?.payload as { pct?: number } | undefined)?.pct ?? 0}%)`, "Pedidos"]}
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                        {metrics.leadTime.buckets.map((b, idx) => (
                          <Cell key={b.key} fill={LEAD_PALETTE[idx % LEAD_PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>

            {/* Cancelamentos por fase + vales a expirar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard
                title="Cancelamentos por fase"
                icon={Ban}
                iconColor="text-rose-500"
                info="Em que estado estava a encomenda quando foi cancelada (pedidos criados no período). Registado desde a mig 111; os antigos aparecem como 'Sem registo'."
              >
                <DistBars
                  data={metrics.cancellations.byPhase.map((p) => ({ label: p.label, count: p.count }))}
                  fills={metrics.cancellations.byPhase.map((p) => (p.key === "sem_registo" ? MUTED : (STATUS_HEX[p.key as OrderStatus] ?? RISK)))}
                  emptyText="Sem cancelamentos no período."
                />
              </ChartCard>
              <ChartCard
                title="Vales a expirar nos próximos 3 meses"
                icon={Gift}
                iconColor="text-amber-500"
                info="Vales 100% pagos, ainda sem preservação marcada, cuja validade acaba nos próximos 90 dias. Não depende do período escolhido."
              >
                {metrics.expiringVouchers.length === 0 ? (
                  <p className="text-sm text-cocoa-700 italic">Nenhum vale a expirar nos próximos 3 meses.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-cocoa-700">
                      <tr>
                        <th className="text-left py-1.5">Vale</th>
                        <th className="text-left py-1.5">Expira</th>
                        <th className="text-right py-1.5">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.expiringVouchers.map((v) => (
                        <tr key={v.id} className="border-t border-cream-100">
                          <td className="py-1.5">
                            <Link href={`/vale-presente/${v.code}`} className="text-cocoa-900 hover:underline underline-offset-2">
                              <span className="font-mono text-xs">{v.code}</span>
                              {v.name ? ` · ${v.name}` : ""}
                            </Link>
                          </td>
                          <td className={cn("py-1.5 text-xs tabular-nums", v.daysLeft <= 30 ? "text-rose-700 font-semibold" : "text-cocoa-700")}>
                            {formatDatePT(v.expiry_date.slice(0, 10))} ({v.daysLeft} d)
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-cocoa-900">{formatEuro(v.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </ChartCard>
            </div>

            {/* Quando chegam os pedidos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard
                title="Pedidos por dia da semana"
                icon={CalendarDays}
                iconColor="text-sky-500"
                info="Hora de Lisboa. Pedidos do período, desde que o formulário existe. Diz-te quando vale a pena estar atenta ao WhatsApp."
              >
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={metrics.requestsByWeekday} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} />
                    <YAxis allowDecimals={false} tick={axisTick} width={28} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: chartGrid, opacity: 0.4 }} formatter={(v: unknown) => [String(v), "Pedidos"]} />
                    <Bar dataKey="count" fill={NEUTRAL} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Pedidos por hora do dia" icon={Clock} iconColor="text-sky-500" info="Hora de Lisboa. Pedidos do período, desde que o formulário existe.">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={metrics.requestsByHour} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="label" tick={{ ...axisTick, fontSize: 9 }} interval={2} />
                    <YAxis allowDecimals={false} tick={axisTick} width={28} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: chartGrid, opacity: 0.4 }} formatter={(v: unknown) => [String(v), "Pedidos"]} />
                    <Bar dataKey="count" fill={NEUTRAL} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Clientes repetidos + recomendações */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <MiniKpi
                icon={Users}
                color="text-violet-500"
                label="Clientes que voltaram"
                value={String(metrics.repeatClients.clientsRepeat)}
                sub={`de ${metrics.repeatClients.clientsTotal} clientes (mesmo email ou telemóvel)`}
                info="Clientes com 2 ou mais pedidos ao longo do tempo, identificados pelo email ou pelo telemóvel."
              />
              <MiniKpi
                icon={Users}
                color="text-emerald-500"
                label="Pedidos de repetentes"
                value={metrics.repeatClients.repeatOrdersPct !== null ? `${metrics.repeatClients.repeatOrdersPct}%` : "—"}
                sub="dos pedidos do período vêm de quem já tinha pedido antes"
              />
              <MiniKpi
                icon={Sparkles}
                color="text-amber-500"
                label="Recomendações de clientes"
                value={
                  metrics.repeatClients.recommendationShareByYear.length > 0
                    ? `${metrics.repeatClients.recommendationShareByYear[metrics.repeatClients.recommendationShareByYear.length - 1].pct}%`
                    : "—"
                }
                sub={
                  metrics.repeatClients.recommendationShareByYear.length > 0
                    ? "por ano: " + metrics.repeatClients.recommendationShareByYear.map((r) => `${r.year}: ${r.pct}%`).join(" · ")
                    : "Sem dados"
                }
                info="Percentagem dos pedidos em que o cliente disse ter conhecido a FBR por recomendação (canal 'Recomendação'), por ano, desde que o formulário existe."
              />
            </div>
          </Section>

          {/* ═══════════ 2. PRODUTO ═══════════ */}
          <Section title="Produto" icon={Frame} sub="O que os clientes do período escolhem">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ChartCard title="Tamanho de moldura" icon={Frame} iconColor="text-violet-500">
                <DistBars data={metrics.ordersByFrameSize} fills={metrics.ordersByFrameSize.map((d) => FRAME_SIZE_HEX[d.key])} />
              </ChartCard>
              <ChartCard title="Tipo de fundo" icon={Palette} iconColor="text-rose-500">
                <DistBars data={metrics.ordersByFrameBackground} fills={metrics.ordersByFrameBackground.map((d) => FRAME_BACKGROUND_HEX[d.key])} />
              </ChartCard>
              <ChartCard title="Tipo de evento" icon={PartyPopper} iconColor="text-emerald-500">
                <DistBars data={metrics.ordersByEventType} fills={metrics.ordersByEventType.map((d) => EVENT_TYPE_HEX[d.key])} />
              </ChartCard>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <ChartCard title="Interesse em upsells" icon={Sparkle} iconColor="text-emerald-500">
                <UpsellsBars data={metrics.upsellsBreakdown} tooltipStyle={tooltipStyle} chartGrid={chartGrid} />
              </ChartCard>
              <ChartCard title="Utilização de cupões 5%" icon={Ticket} iconColor="text-amber-500">
                <DistBars
                  data={metrics.couponUsageDist}
                  fills={metrics.couponUsageDist.map((d) => COUPON_STATUS_HEX[d.key])}
                  emptyText="Ainda não há cupões emitidos no período."
                />
              </ChartCard>
              <MiniKpi
                icon={Sparkles}
                color="text-amber-500"
                label="% pedidos com extras"
                value={`${metrics.extrasOrdersPct}%`}
                sub="Pedidos do período com extras no quadro (opções ou notas)"
              />
            </div>
          </Section>

          {/* ═══════════ 3. OPERAÇÃO ═══════════ */}
          <Section title="Operação" icon={Wrench} sub="Prazos, fases, resposta e logística">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <MiniKpi
                icon={Clock}
                color="text-sky-500"
                label="Tempo médio de conclusão"
                value={metrics.avgCompletionGlobal !== null ? `${metrics.avgCompletionGlobal} dias` : "—"}
                sub={metrics.avgCompletionRecent !== null ? `Últimos 6 meses: ${metrics.avgCompletionRecent} dias` : undefined}
                info="Da criação do pedido à entrega do quadro (encomendas em 'Quadro recebido'), só pedidos desde que o formulário existe."
              />
              <MiniKpi
                icon={MessageCircle}
                color="text-emerald-500"
                label="1.ª resposta no WhatsApp (mediana)"
                value={metrics.whatsappResponse.medianHours !== null ? `${metrics.whatsappResponse.medianHours} h` : "—"}
                sub={
                  metrics.whatsappResponse.sample > 0
                    ? `${metrics.whatsappResponse.within1hPct}% em menos de 1 h · ${metrics.whatsappResponse.within24hPct}% em menos de 24 h · ${metrics.whatsappResponse.sample} pedidos`
                    : "Sem dados: precisa da migração 113 e de pedidos com conversa no WhatsApp"
                }
                info="Tempo entre o pedido (formulário) e a primeira mensagem tua na conversa de WhatsApp com o mesmo telemóvel (últimos 9 dígitos). Só pedidos do período com conversa emparelhada."
              />
              <MiniKpi
                icon={MessageCircle}
                color="text-amber-500"
                label="1.ª resposta: 90% em menos de"
                value={metrics.whatsappResponse.p90Hours !== null ? `${metrics.whatsappResponse.p90Hours} h` : "—"}
                sub="9 em cada 10 pedidos com conversa tiveram resposta dentro deste tempo"
              />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <ChartCard
                title="Dias em cada fase (mediana)"
                icon={Layers}
                iconColor="text-violet-500"
                info="Quantos dias uma encomenda fica em cada estado antes de passar ao seguinte, pela ordem de produção. Só fases já concluídas e só pedidos desde que o formulário existe. Precisa da migração 113 (histórico de estados)."
              >
                {metrics.phaseDurations.length === 0 ? (
                  <p className="text-sm text-cocoa-700 italic">Sem histórico de estados ainda (migração 113).</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(220, metrics.phaseDurations.length * 30)}>
                    <BarChart data={metrics.phaseDurations} layout="vertical" margin={{ left: 24, right: 40 }}>
                      <XAxis type="number" tick={axisTick} unit=" d" />
                      <YAxis type="category" dataKey="label" width={180} tick={axisTick} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: unknown, _n, item) => [`${v} dias (${(item?.payload as { sample?: number } | undefined)?.sample ?? 0} encomendas)`, "Mediana"]}
                      />
                      <Bar dataKey="medianDays" radius={[0, 6, 6, 0]}>
                        {metrics.phaseDurations.map((p) => (
                          <Cell key={p.status} fill={STATUS_HEX[p.status] ?? NEUTRAL} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
              <ChartCard
                title="Pedidos do período por estado actual"
                icon={Sparkles}
                iconColor="text-violet-500"
                info="Em que estado estão hoje os pedidos criados no período, pela ordem de produção (cancelados no fim)."
              >
                {metrics.ordersByStatus.length === 0 ? (
                  <p className="text-sm text-cocoa-700 italic">Sem pedidos no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={Math.max(220, metrics.ordersByStatus.length * 30)}>
                    <BarChart data={metrics.ordersByStatus} layout="vertical" margin={{ left: 24, right: 24 }}>
                      <XAxis type="number" allowDecimals={false} tick={axisTick} />
                      <YAxis type="category" dataKey="label" width={180} tick={axisTick} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [String(v), "Pedidos"]} />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                        {metrics.ordersByStatus.map((row) => (
                          <Cell key={row.status} fill={STATUS_HEX[row.status as OrderStatus]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            <ChartCard
              title="Sazonalidade: eventos por mês do ano"
              icon={CalendarDays}
              iconColor="text-emerald-500"
              info="Quantos eventos (data do evento, encomendas não canceladas) caem em cada mês, com os últimos anos lado a lado. Mostra a época alta para planear. Não depende do período escolhido."
            >
              {metrics.eventSeasonality.years.length === 0 ? (
                <p className="text-sm text-cocoa-700 italic">Sem eventos com data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={metrics.eventSeasonality.months.map((m) => ({ label: m.label, ...m.counts }))} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="label" tick={axisTick} />
                    <YAxis allowDecimals={false} tick={axisTick} width={32} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: chartGrid, opacity: 0.4 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {metrics.eventSeasonality.years.map((y, idx) => (
                      <Bar key={y} dataKey={String(y)} name={String(y)} fill={YEAR_PALETTE[idx % YEAR_PALETTE.length]} radius={[3, 3, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <ChartCard title="Envio das flores" icon={Car} iconColor="text-violet-500">
                <DistBars data={metrics.flowerDeliveryDist} fills={metrics.flowerDeliveryDist.map((d) => FLOWER_DELIVERY_HEX[d.key])} />
              </ChartCard>
              <ChartCard title="Receção do quadro" icon={Package} iconColor="text-sky-500">
                <DistBars data={metrics.frameDeliveryDist} fills={metrics.frameDeliveryDist.map((d) => FRAME_DELIVERY_HEX[d.key])} />
              </ChartCard>
              <ChartCard title="Preferência de contacto" icon={MessageCircle} iconColor="text-emerald-500">
                <DistBars data={metrics.contactPrefDist} fills={metrics.contactPrefDist.map((d) => CONTACT_PREF_HEX[d.key])} />
              </ChartCard>
              <ChartCard
                title="Cidades dos eventos"
                icon={MapPin}
                iconColor="text-rose-500"
                info="Cidade aproximada a partir da morada do evento (o segmento antes de 'Portugal', sem código postal). Pedidos do período. Útil para escolher onde procurar parceiros."
              >
                <DistBars
                  data={metrics.topCities.map((c) => ({ label: c.city, count: c.count }))}
                  emptyText="Sem moradas de evento no período."
                />
              </ChartCard>
            </div>
          </Section>

          {/* ═══════════ 4. REDE ═══════════ */}
          <Section title="Rede" icon={Wifi} sub="De onde vêm os pedidos e quem os recomenda">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <ChartCard
                title="Top 5 canais de aquisição"
                icon={Wifi}
                iconColor="text-fuchsia-500"
                info="Como os clientes do período disseram ter conhecido a FBR."
              >
                <DistBars data={metrics.topAcquisition} />
              </ChartCard>
              {metrics.topPartners.length > 0 ? (
                <ChartCard
                  title="Top 5 parceiros (receita + comissões)"
                  icon={Trophy}
                  iconColor="text-amber-500"
                  info="Receita = dinheiro recebido das encomendas deste parceiro no período (parcelas pela data de pagamento; sem data, pela data do evento). Comissões em valor total acordado: 'Paga' = já liquidada; 'Por pagar' = em dívida; 'Total' = soma. Estados 'N/A' e 'Não aceita' não contam."
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                      <thead className="text-xs uppercase tracking-wider text-cocoa-700">
                        <tr>
                          <th className="text-left py-2">#</th>
                          <th className="text-left py-2">Parceiro</th>
                          <th className="text-right py-2">Receita</th>
                          <th className="text-right py-2">Comissão paga</th>
                          <th className="text-right py-2">Por pagar</th>
                          <th className="text-right py-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.topPartners.map((p, idx) => {
                          const podiumColor = idx === 0 ? "text-amber-500" : idx === 1 ? "text-stone-500" : idx === 2 ? "text-orange-600" : "text-cocoa-700";
                          return (
                            <tr key={p.partner_id} className="border-t border-cream-100 hover:bg-cream-50 transition-colors">
                              <td className="py-2 w-10">
                                <div className="flex items-center gap-1.5">
                                  {idx < 3 && <Trophy className={cn("h-4 w-4", podiumColor)} />}
                                  <span className="text-xs font-semibold text-cocoa-700">{idx + 1}</span>
                                </div>
                              </td>
                              <td className="py-2 text-cocoa-900 font-medium">
                                <Link href={`/parcerias/${p.partner_id}`} className="hover:underline">
                                  {partnerNames[p.partner_id] ?? p.partner_id.slice(0, 8) + "…"}
                                </Link>
                              </td>
                              <td className="py-2 text-right tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{formatEuro(p.revenue)}</td>
                              <td className="py-2 text-right tabular-nums text-emerald-700/80 dark:text-emerald-400/80">{formatEuro(p.commissionsPaid)}</td>
                              <td className="py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">{formatEuro(p.commissionsDue)}</td>
                              <td className="py-2 text-right tabular-nums font-semibold text-cocoa-900">{formatEuro(p.commissionsTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              ) : (
                <ChartCard title="Top 5 parceiros" icon={Trophy} iconColor="text-amber-500">
                  <p className="text-sm text-cocoa-700 italic">Sem encomendas com parceiro no período.</p>
                </ChartCard>
              )}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
