"use client";

import { useState, useMemo } from "react";
import { useTheme } from "next-themes";
import {
  LineChart as LineChartIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  RefreshCw,
  ShoppingBag,
  Filter,
  CalendarClock,
  Ban,
  Timer,
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
  PieChart,
  Pie,
  Cell,
  Legend,
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
} from "@/types/database";

import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import {
  computeMetrics,
  generateInsights,
  rangeFromPreset,
  RANGE_PRESET_LABELS,
  type RangePreset,
  type DateRange,
} from "@/lib/metrics";

// Paleta genérica (usada onde não há cor "natural" por categoria).
const ACQ_PALETTE       = ["#c084fc", "#60a5fa", "#34d399", "#facc15", "#fb923c"];

// Cores semânticas para o fundo do quadro — aproximam o significado real
// de cada opção em vez de um arco-íris aleatório.
const FRAME_BACKGROUND_HEX: Record<FrameBackground, string> = {
  transparente:     "#cbd5e1", // slate-300 (vidro/transparente)
  preto:            "#374151", // gray-700 (preto, legível)
  branco:           "#e5e7eb", // gray-200 (branco/claro)
  fotografia:       "#3b82f6", // blue-500 (fotografia)
  cor:              "#d946ef", // fuchsia-500 (cor viva)
  voces_a_escolher: "#94a3b8", // slate-400 (à nossa escolha)
  nao_sei:          "#a8a29e", // stone-400 (não sei)
};

// Tamanho de moldura não tem cor "natural" → escala da marca, do mais
// claro (menor) ao mais escuro (maior).
const FRAME_SIZE_HEX: Record<FrameSize, string> = {
  "30x40":          "#D4C19F",
  "40x50":          "#C4A882",
  "50x70":          "#9C7B4E",
  voces_a_escolher: "#94a3b8",
  nao_sei:          "#a8a29e",
};

// Tipo de evento — cor distinta e com alguma lógica (casamento rosa,
// funeral sóbrio, etc.).
const EVENT_TYPE_HEX: Record<EventType, string> = {
  casamento:        "#f472b6", // pink (romance)
  batizado:         "#60a5fa", // blue
  funeral:          "#64748b", // slate (sóbrio)
  pedido_casamento: "#fb7185", // rose
  outro:            "#a8a29e", // stone
};

// Paletas semânticas — espelham as cores Tailwind usadas como badges
// noutras zonas da app (types/database.ts, preservacao, entregas-recolhas)
// para que um cliente "CTT" tenha sempre a mesma cor onde quer que apareça.
const FLOWER_DELIVERY_HEX: Record<FlowerDeliveryMethod, string> = {
  maos:           "#10b981", // emerald-500 (em mãos)
  ctt:            "#0ea5e9", // sky-500 (CTT)
  recolha_evento: "#8b5cf6", // violet-500 (recolha no local)
  nao_sei:        "#a8a29e", // stone-400 (não sei)
};
const FRAME_DELIVERY_HEX: Record<FrameDeliveryMethod, string> = {
  maos:    "#10b981",
  ctt:     "#0ea5e9",
  nao_sei: "#a8a29e",
};
const CONTACT_PREF_HEX: Record<ContactPreference, string> = {
  whatsapp: "#10b981", // verde estilo WhatsApp
  email:    "#0ea5e9", // sky
};
const COUPON_STATUS_HEX: Record<CouponStatus, string> = {
  utilizado:     "#10b981", // emerald (sucesso)
  nao_utilizado: "#f59e0b", // amber (em aberto)
  na:            "#a8a29e", // stone (não aplicável)
};
// Para upsells: "sim" sólido emerald, "mais info" amber (em dúvida)
const UPSELL_HEX = {
  sim:      "#10b981",
  maisInfo: "#f59e0b",
};

const formatEuro = (value: number): string => formatEUR(value, { rounded: true });

// Cores dos buckets de antecedência: do "depois do evento" (rosa, o caso a
// vigiar) até "mais de 6 meses antes" (violeta).
const LEAD_PALETTE = ["#f43f5e", "#f59e0b", "#eab308", "#0ea5e9", "#10b981", "#8b5cf6"];

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
  /** Explicação do que o valor mede (mostrada num tooltip no ícone ⓘ). */
  info?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 space-y-2",
        gradient,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] uppercase tracking-wider font-semibold text-cocoa-900/70 dark:text-[#E8D5B5]/70">
          {label}
          {info && (
            <span title={info} className="cursor-help inline-flex">
              <Info className="h-3 w-3 opacity-60" />
            </span>
          )}
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
        <span className="text-3xl font-bold text-cocoa-900 tabular-nums">
          {value}
        </span>
        {pct !== undefined && <PctBadge pct={pct} />}
      </div>
      {sub && (
        <div className="text-[11px] text-cocoa-900/60 dark:text-[#E8D5B5]/60">
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
    <div className="rounded-2xl border border-cream-200 bg-surface p-5 space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color)} />
        <div className="text-xs uppercase tracking-wider text-cocoa-700 font-medium">
          {label}
        </div>
      </div>
      <div className="text-xl font-semibold text-cocoa-900 tabular-nums">
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-cocoa-700">{sub}</div>
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
  info,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  children: React.ReactNode;
  className?: string;
  /** Explicação do que o gráfico mede (tooltip no ícone ⓘ). */
  info?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-cream-200 bg-surface p-5 space-y-3",
        className,
      )}
    >
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
  const [preset, setPreset] = useState<RangePreset>("desde_sempre");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const chartGrid = isDark ? "#322821" : "#E8E0D5";
  const chartTooltipBg = isDark ? "#1B1611" : "#FFFFFF";
  const chartTooltipBorder = isDark ? "#322821" : "#E8E0D5";
  const chartTooltipText = isDark ? "#E8D5B5" : "#3D2B1F";
  const tooltipStyle = {
    borderRadius: 8,
    border: `1px solid ${chartTooltipBorder}`,
    background: chartTooltipBg,
    color: chartTooltipText,
    fontSize: 12,
  } as const;

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
    () => (range ? computeMetrics(initialOrders, initialVouchers, range, new Date(), preset) : null),
    [range, initialOrders, initialVouchers, preset],
  );

  const insights = useMemo(
    () => (metrics ? generateInsights(metrics, partnerNames) : []),
    [metrics, partnerNames],
  );

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header com fundo gradiente subtil */}
      <div className="rounded-2xl bg-gradient-to-br from-rose-50 via-amber-50 to-emerald-50 dark:from-rose-950/30 dark:via-amber-950/20 dark:to-emerald-950/30 border border-cream-200 p-4 lg:p-5 flex flex-wrap items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-surface/80/80 shadow-sm flex items-center justify-center">
          <LineChartIcon className="h-6 w-6 text-rose-500" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-cocoa-900">
            Métricas
          </h1>
          <p className="text-sm text-cocoa-700">
            Última actualização: {formatDateTimeLisbon(loadedAt)}
          </p>
          <p className="text-xs text-cocoa-700">
            Receita, custos e lucro vivem nas{" "}
            <Link href="/financas" className="underline underline-offset-2 hover:text-cocoa-900">
              Finanças
            </Link>
            . Aqui: pedidos, conversão, canais e operação.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
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
          <Button
            size="sm"
            variant="outline"
            className="bg-surface"
            onClick={() => window.location.reload()}
            title="Actualizar dados"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Actualizar
          </Button>
        </div>
      </div>

      {preset === "personalizado" && (
        <div className="flex items-center gap-3 bg-cream-50 border border-cream-200 rounded-xl p-3">
          <span className="text-xs text-cocoa-700">
            Período personalizado:
          </span>
          <Input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="h-8 w-auto text-xs"
          />
          <span className="text-xs text-cocoa-700">→</span>
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
            {/* Os cartões de receita saíram (sessão 174): viviam também nas
                Finanças com nomes diferentes. A Métricas fica com pedidos,
                conversão e operação. */}
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
              info="Pedidos criados no período que estão cancelados, e a fase em que estavam quando cancelaram (registada desde a mig 111; os antigos aparecem como 'Sem registo')."
              sub={
                metrics.cancellations.pct !== null
                  ? `${metrics.cancellations.pct}% dos pedidos do período`
                  : "Sem pedidos no período"
              }
              icon={Ban}
              gradient="bg-gradient-to-br from-rose-50 to-red-100 border-rose-200 dark:from-rose-950/40 dark:to-red-900/30 dark:border-rose-900/50"
              iconBg="bg-rose-500"
              iconColor="text-white"
            />
            <HeroKpiCard
              label="Encomendas novas"
              value={String(metrics.newOrders)}
              pct={metrics.showComparison ? metrics.newOrdersPctChange : undefined}
              sub={
                metrics.showComparison
                  ? `vs. ${metrics.comparisonLabel}: ${metrics.newOrdersPrev}`
                  : "Todas as encomendas (data de criação)"
              }
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

          {/* Funil pedido → sinal, por canal (sessão 174) */}
          <ChartCard
            title="Funil pedido → sinal, por canal"
            icon={Filter}
            iconColor="text-emerald-500"
            info="Pedidos criados no período (data de criação) e quantos pagaram o sinal, por canal de aquisição. 'Sem resposta' = o cliente não disse como conheceu a FBR."
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="text-xs uppercase tracking-wider text-cocoa-700">
                    <tr>
                      <th className="text-left py-2">Canal</th>
                      <th className="text-right py-2">Pedidos</th>
                      <th className="text-right py-2">Com sinal</th>
                      <th className="text-right py-2">Taxa</th>
                      <th className="text-right py-2">Cancelados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.funnel.byChannel.length === 0 && (
                      <tr><td colSpan={5} className="py-3 text-center text-cocoa-700 italic">Sem pedidos no período.</td></tr>
                    )}
                    {metrics.funnel.byChannel.map((c) => (
                      <tr key={c.key} className="border-t border-cream-100">
                        <td className="py-2 text-cocoa-900">{c.label}</td>
                        <td className="py-2 text-right tabular-nums text-cocoa-900">{c.total}</td>
                        <td className="py-2 text-right tabular-nums text-emerald-700">{c.confirmed}</td>
                        <td className={cn("py-2 text-right tabular-nums font-semibold", (c.confirmedPct ?? 0) >= 50 ? "text-emerald-700" : (c.confirmedPct ?? 0) >= 30 ? "text-amber-700" : "text-rose-700")}>
                          {c.confirmedPct !== null ? `${c.confirmedPct}%` : "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums text-rose-700">{c.cancelled}</td>
                      </tr>
                    ))}
                    {metrics.funnel.byChannel.length > 1 && (
                      <tr className="border-t-2 border-cream-300 font-semibold">
                        <td className="py-2 text-cocoa-900">Total</td>
                        <td className="py-2 text-right tabular-nums text-cocoa-900">{metrics.funnel.total}</td>
                        <td className="py-2 text-right tabular-nums text-emerald-700">{metrics.funnel.confirmed}</td>
                        <td className="py-2 text-right tabular-nums text-cocoa-900">{metrics.funnel.confirmedPct !== null ? `${metrics.funnel.confirmedPct}%` : "—"}</td>
                        <td className="py-2 text-right tabular-nums text-rose-700">{metrics.funnel.cancelled}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <MiniKpi
                icon={Timer}
                color="text-sky-500"
                label="Tempo até ao sinal (mediana)"
                value={metrics.funnel.medianDaysToDeposit !== null ? `${metrics.funnel.medianDaysToDeposit} dias` : "—"}
                sub={
                  metrics.funnel.depositSample > 0
                    ? `${metrics.funnel.depositSample} pedido${metrics.funnel.depositSample === 1 ? "" : "s"} com data de pagamento`
                    : "Sem datas de pagamento ainda (mig 111)"
                }
              />
            </div>
          </ChartCard>

          {/* Antecedência da reserva — só preservação (pedido da Maria, sessão 174) */}
          <ChartCard
            title="Com que antecedência reservam? (preservação)"
            icon={CalendarClock}
            iconColor="text-violet-500"
            info="Dias entre o pedido e a data do evento, só nas encomendas de preservação (nas flores secas e na recriação o evento é sempre no passado). 'Depois do evento' = o pedido chegou depois do casamento. Conta só pedidos desde que o formulário público existe, porque as encomendas importadas do Monday têm a data de criação errada."
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
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11 }} />
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
              info="Em que estado estava a encomenda quando foi cancelada (pedidos criados no período). Registado pela base de dados desde a mig 111; os cancelamentos antigos aparecem como 'Sem registo'."
            >
              {metrics.cancellations.byPhase.length === 0 ? (
                <p className="text-sm text-cocoa-700 italic">Sem cancelamentos no período.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {metrics.cancellations.byPhase.map((p) => (
                      <tr key={p.key} className="border-t border-cream-100 first:border-t-0">
                        <td className="py-1.5 text-cocoa-900">{p.label}</td>
                        <td className="py-1.5 text-right tabular-nums font-semibold text-rose-700 w-16">{p.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ChartCard>
            <ChartCard
              title="Vales a expirar nos próximos 3 meses"
              icon={Gift}
              iconColor="text-amber-500"
              info="Vales 100% pagos, ainda sem preservação marcada, cuja validade acaba nos próximos 90 dias. Um lembrete a tempo evita perder o cliente e o crédito. Não depende do período escolhido."
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
                            <span className="font-mono text-xs">{v.code}</span>{v.name ? ` · ${v.name}` : ""}
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
                  <Tooltip contentStyle={tooltipStyle} />
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
              <PieDist
                data={metrics.ordersByFrameSize}
                fills={metrics.ordersByFrameSize.map((d) => FRAME_SIZE_HEX[d.key])}
              />
            </ChartCard>
            <ChartCard title="Tipo de fundo" icon={Palette} iconColor="text-rose-500">
              <PieDist
                data={metrics.ordersByFrameBackground}
                fills={metrics.ordersByFrameBackground.map((d) => FRAME_BACKGROUND_HEX[d.key])}
              />
            </ChartCard>
            <ChartCard title="Tipo de evento" icon={PartyPopper} iconColor="text-emerald-500">
              <PieDist
                data={metrics.ordersByEventType}
                fills={metrics.ordersByEventType.map((d) => EVENT_TYPE_HEX[d.key])}
              />
            </ChartCard>
          </div>

          {/* Logística & comunicação — cores semânticas alinhadas com badges */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Método de envio das flores" icon={Car} iconColor="text-violet-500">
              <PieDist
                data={metrics.flowerDeliveryDist}
                fills={metrics.flowerDeliveryDist.map((d) => FLOWER_DELIVERY_HEX[d.key])}
              />
            </ChartCard>
            <ChartCard title="Método de receção do quadro" icon={Package} iconColor="text-sky-500">
              <PieDist
                data={metrics.frameDeliveryDist}
                fills={metrics.frameDeliveryDist.map((d) => FRAME_DELIVERY_HEX[d.key])}
              />
            </ChartCard>
            <ChartCard title="Preferência de contacto" icon={MessageCircle} iconColor="text-emerald-500">
              <PieDist
                data={metrics.contactPrefDist}
                fills={metrics.contactPrefDist.map((d) => CONTACT_PREF_HEX[d.key])}
              />
            </ChartCard>
          </div>

          {/* Cupões 5% + Upsells — duas colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Utilização de cupões 5%" icon={Ticket} iconColor="text-amber-500">
              {metrics.couponUsageDist.length === 0 ? (
                <p className="text-sm text-cocoa-700 py-12 text-center">
                  Ainda não há cupões emitidos no período.
                </p>
              ) : (
                <PieDist
                  data={metrics.couponUsageDist}
                  fills={metrics.couponUsageDist.map((d) => COUPON_STATUS_HEX[d.key])}
                />
              )}
            </ChartCard>
            <ChartCard title="Interesse em upsells" icon={Sparkle} iconColor="text-emerald-500">
              <UpsellsBars data={metrics.upsellsBreakdown} tooltipStyle={tooltipStyle} chartGrid={chartGrid} />
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
                  <Tooltip contentStyle={tooltipStyle} />
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
              info="Receita = dinheiro já recebido das encomendas deste parceiro (orçamento × %pago). Comissões em valor total acordado (não proporcional ao que a cliente já pagou): 'Paga' = já liquidada ao parceiro; 'Por pagar' = ainda em dívida; 'Total' = soma das duas. Estados 'N/A' e 'Não aceita' não contam."
            >
              {/* overflow-x-auto + min-w: 6 colunas de € não cabem num telemóvel;
                  ganha scroll horizontal em vez de esmagar. No PC nada muda. */}
              <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-xs uppercase tracking-wider text-cocoa-700">
                  <tr>
                    <th className="text-left py-2">#</th>
                    <th className="text-left py-2">Parceiro</th>
                    <th className="text-right py-2">Receita</th>
                    <th className="text-right py-2" title="Comissão já liquidada ao parceiro (estado 'Paga')">Comissão paga</th>
                    <th className="text-right py-2" title="Comissão ainda em dívida ao parceiro (parceiro informado / a aguardar)">Por pagar</th>
                    <th className="text-right py-2" title="Soma da comissão paga + por pagar">Total</th>
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
                            : "text-cocoa-700";
                    const podiumIcon = idx < 3 ? <Trophy className={cn("h-4 w-4", podiumColor)} /> : null;
                    return (
                      <tr
                        key={p.partner_id}
                        className="border-t border-cream-100 hover:bg-cream-50 transition-colors"
                      >
                        <td className="py-2 w-10">
                          <div className="flex items-center gap-1.5">
                            {podiumIcon}
                            <span className="text-xs font-semibold text-cocoa-700">
                              {idx + 1}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 text-cocoa-900 font-medium">
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
                        <td className="py-2 text-right tabular-nums text-emerald-700/80 dark:text-emerald-400/80">
                          {formatEuro(p.commissionsPaid)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
                          {formatEuro(p.commissionsDue)}
                        </td>
                        <td className="py-2 text-right tabular-nums font-semibold text-cocoa-900">
                          {formatEuro(p.commissionsTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}

// Stacked bar horizontal — uma linha por upsell, segmentos "Sim" + "Mais info".
// Mostra rapidamente quais extras geram mais interesse.
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
    return (
      <p className="text-sm text-cocoa-700 py-12 text-center">
        Sem dados de upsells no período.
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 50)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24, right: 24 }} stackOffset="sign">
        <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="sim" name="Sim" stackId="upsell" fill={UPSELL_HEX.sim} radius={[0, 0, 0, 0]} />
        <Bar dataKey="maisInfo" name="Mais info" stackId="upsell" fill={UPSELL_HEX.maisInfo} radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function renderPieSliceLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  value?: number;
}) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, value } = props;
  if (
    cx == null ||
    cy == null ||
    midAngle == null ||
    innerRadius == null ||
    outerRadius == null ||
    value == null
  ) {
    return null;
  }
  if ((percent ?? 0) < 0.06) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
      style={{ pointerEvents: "none" }}
    >
      {value}
    </text>
  );
}

function PieDist({
  data,
  palette,
  fills,
}: {
  data: Array<{ label: string; count: number }>;
  palette?: string[];
  /** Cores pré-mapeadas por índice (espelha 1:1 com `data`). Sobrepõe-se a `palette`. */
  fills?: string[];
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  if (data.length === 0) {
    return (
      <p className="text-sm text-cocoa-700 py-12 text-center">
        Sem dados no período.
      </p>
    );
  }
  const colorAt = (idx: number): string => {
    if (fills && fills[idx]) return fills[idx];
    if (palette && palette.length > 0) return palette[idx % palette.length];
    return "#a8a29e";
  };
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
          label={renderPieSliceLabel}
          labelLine={false}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={colorAt(idx)} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: `1px solid ${isDark ? "#322821" : "#E8E0D5"}`,
            background: isDark ? "#1B1611" : "#FFFFFF",
            color: isDark ? "#E8D5B5" : "#3D2B1F",
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
