"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  Filter,
  Box,
  Frame,
  Car,
  Construction,
  Search,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import {
  format,
  parseISO,
  differenceInDays,
  isToday,
  isTomorrow,
  isSameWeek,
  isThisWeek,
  startOfDay,
  addDays,
} from "date-fns";
import { pt } from "date-fns/locale";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Order, OrderStatus } from "@/types/database";
import { EVENT_TYPE_LABELS } from "@/types/database";
import LogisticsMap, { type MapMarker } from "./logistics-map";

type LogisticsKind = "recolha_evento" | "envio_ctt_flores" | "envio_ctt_quadro";

interface LogisticsItem {
  order: Order;
  date: string;
  kind: LogisticsKind;
  location: string;
  /** Janela horária (apenas recolha_evento) */
  timeFrom?: string | null;
  timeTo?: string | null;
  /** Recolha/envio já concluído (baseado no estado da encomenda) */
  completed: boolean;
}

// Estados a partir dos quais as flores já foram recebidas — uma recolha
// no local ou um envio CTT das flores nestes estados é considerado feito.
const FLOWERS_RECEIVED_OR_LATER: OrderStatus[] = [
  "flores_recebidas",
  "flores_na_prensa",
  "reconstrucao_botanica",
  "a_compor_design",
  "a_aguardar_aprovacao",
  "a_finalizar_quadro",
  "a_ser_emoldurado",
  "emoldurado",
  "a_ser_fotografado",
  "quadro_pronto",
  "quadro_enviado",
  "quadro_recebido",
];

const KIND_LABELS: Record<LogisticsKind, string> = {
  recolha_evento: "Recolha no local",
  envio_ctt_flores: "Envio CTT — flores",
  envio_ctt_quadro: "Envio CTT — quadro",
};

const KIND_COLORS: Record<LogisticsKind, string> = {
  recolha_evento:
    "from-emerald-50 to-green-100 border-emerald-300 text-emerald-900 dark:from-emerald-950/40 dark:to-emerald-900/30 dark:border-emerald-800 dark:text-emerald-200",
  envio_ctt_flores:
    "from-sky-50 to-blue-100 border-sky-300 text-sky-900 dark:from-sky-950/40 dark:to-blue-900/30 dark:border-sky-800 dark:text-sky-200",
  envio_ctt_quadro:
    "from-violet-50 to-purple-100 border-violet-300 text-violet-900 dark:from-violet-950/40 dark:to-purple-900/30 dark:border-violet-800 dark:text-violet-200",
};

const KIND_ICON: Record<LogisticsKind, React.ComponentType<{ className?: string }>> = {
  recolha_evento: Car,
  envio_ctt_flores: Box,
  envio_ctt_quadro: Frame,
};

function isCompleted(item: { kind: LogisticsKind; order: Order }): boolean {
  const s = item.order.status;
  if (item.kind === "recolha_evento" || item.kind === "envio_ctt_flores") {
    return FLOWERS_RECEIVED_OR_LATER.includes(s);
  }
  // envio_ctt_quadro: concluído quando o quadro foi recebido
  return s === "quadro_recebido";
}

function getAllLogistics(orders: Order[]): LogisticsItem[] {
  const items: LogisticsItem[] = [];
  for (const o of orders) {
    if (o.status === "cancelado") continue;

    // Recolha no local
    if (
      o.flower_delivery_method === "recolha_evento" &&
      (o.pickup_date ?? o.event_date)
    ) {
      const date = o.pickup_date ?? o.event_date!;
      const base = {
        order: o,
        date,
        kind: "recolha_evento" as const,
        location: o.pickup_address ?? o.event_location ?? "—",
        timeFrom: o.pickup_time_from,
        timeTo: o.pickup_time_to,
      };
      items.push({ ...base, completed: isCompleted(base) });
    }

    // Envio CTT flores (cliente envia até à data do evento)
    if (o.flower_delivery_method === "ctt" && o.event_date) {
      const base = {
        order: o,
        date: o.event_date,
        kind: "envio_ctt_flores" as const,
        location: o.event_location ?? "—",
      };
      items.push({ ...base, completed: isCompleted(base) });
    }

    // Envio CTT do quadro (de nós para o cliente)
    const frameSendDate = o.frame_delivery_date ?? o.estimated_delivery_date;
    if (
      o.frame_delivery_method === "ctt" &&
      frameSendDate &&
      ["quadro_pronto", "quadro_enviado", "quadro_recebido"].includes(o.status)
    ) {
      const base = {
        order: o,
        date: frameSendDate,
        kind: "envio_ctt_quadro" as const,
        location: o.event_location ?? "—",
      };
      items.push({ ...base, completed: isCompleted(base) });
    }
  }
  return items.sort((a, b) => {
    // Ordena por data ascendente; dentro da mesma data, por hora de início
    const dateCmp = a.date.localeCompare(b.date);
    if (dateCmp !== 0) return dateCmp;
    const tA = a.timeFrom ?? "99:99";
    const tB = b.timeFrom ?? "99:99";
    return tA.localeCompare(tB);
  });
}

type FilterKind = "todas" | LogisticsKind;

type MapFilter = "recolhas" | "ctt" | "ambos";

export default function EntregasRecolhasClient({ orders }: { orders: Order[] }) {
  const [kindFilter, setKindFilter] = useState<FilterKind>("todas");
  const [search, setSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [mapFilter, setMapFilter] = useState<MapFilter>("recolhas");

  const allItems = useMemo(() => getAllLogistics(orders), [orders]);

  // Datas de referência calculadas uma vez (evita Date.now() durante render)
  const tomorrowSubtitle = useMemo(
    () => format(addDays(new Date(), 1), "EEEE · dd/MM/yyyy", { locale: pt }),
    [],
  );
  const todaySubtitle = useMemo(
    () => format(new Date(), "EEEE · dd/MM/yyyy", { locale: pt }),
    [],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((i) => {
      if (kindFilter !== "todas" && i.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        i.order.client_name.toLowerCase().includes(q) ||
        i.location.toLowerCase().includes(q) ||
        i.order.order_id.toLowerCase().includes(q)
      );
    });
  }, [allItems, kindFilter, search]);

  // Separa em buckets — atrasadas só conta itens NÃO concluídos no passado.
  const buckets = useMemo(() => {
    const today = startOfDay(new Date());
    const acc = {
      atrasadas: [] as LogisticsItem[],
      hoje: [] as LogisticsItem[],
      amanha: [] as LogisticsItem[],
      restoSemana: [] as LogisticsItem[],
      proximaSemana: [] as LogisticsItem[],
      maisTarde: [] as LogisticsItem[],
      concluidas: [] as LogisticsItem[],
    };
    for (const i of filtered) {
      if (i.completed) {
        acc.concluidas.push(i);
        continue;
      }
      const d = parseISO(i.date);
      const diff = differenceInDays(startOfDay(d), today);
      if (diff < 0) acc.atrasadas.push(i);
      else if (isToday(d)) acc.hoje.push(i);
      else if (isTomorrow(d)) acc.amanha.push(i);
      else if (isThisWeek(d, { weekStartsOn: 1 })) acc.restoSemana.push(i);
      else if (
        isSameWeek(d, new Date(today.getTime() + 7 * 86400_000), {
          weekStartsOn: 1,
        })
      )
        acc.proximaSemana.push(i);
      else acc.maisTarde.push(i);
    }
    // Concluídas: mais recentes primeiro
    acc.concluidas.sort((a, b) => b.date.localeCompare(a.date));
    return acc;
  }, [filtered]);

  // Contagens nas cards do topo — só itens pendentes (concluídos
  // não contam, senão os números nunca baixam).
  const counts = useMemo(() => {
    const pending = allItems.filter((i) => !i.completed);
    return {
      todas: pending.length,
      recolha_evento: pending.filter((i) => i.kind === "recolha_evento").length,
      envio_ctt_flores: pending.filter((i) => i.kind === "envio_ctt_flores").length,
      envio_ctt_quadro: pending.filter((i) => i.kind === "envio_ctt_quadro").length,
    };
  }, [allItems]);

  // Marcadores do mapa: só itens pendentes; respeita o filtro do mapa
  // (independente das KPI cards). Default: só recolhas no local.
  const mapMarkers = useMemo<MapMarker[]>(() => {
    return allItems
      .filter((i) => {
        if (i.completed) return false;
        if (mapFilter === "recolhas") return i.kind === "recolha_evento";
        if (mapFilter === "ctt")
          return i.kind === "envio_ctt_flores" || i.kind === "envio_ctt_quadro";
        return true;
      })
      .map((i) => ({
        id: `${i.order.id}-${i.kind}`,
        kind: i.kind,
        date: i.date,
        location: i.location,
        timeFrom: i.timeFrom,
        timeTo: i.timeTo,
        orderHref: `/preservacao/${i.order.order_id ?? i.order.id}`,
        orderRef: i.order.order_id,
        clientName: i.order.client_name,
        eventLabel: i.order.event_type
          ? EVENT_TYPE_LABELS[i.order.event_type]
          : null,
      }));
  }, [allItems, mapFilter]);

  const totalAgendadas =
    buckets.atrasadas.length +
    buckets.hoje.length +
    buckets.amanha.length +
    buckets.restoSemana.length +
    buckets.proximaSemana.length +
    buckets.maisTarde.length;

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 shadow-sm flex items-center justify-center">
          <Truck className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-cocoa-900">
            Entregas e Recolhas
          </h1>
          <p className="text-sm text-cocoa-700">
            Agenda de quem vai fazer recolhas no local e envios CTT
          </p>
        </div>
      </div>

      {/* Filtros por tipo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KindFilterCard
          label="Todas"
          icon={Filter}
          color="from-stone-50 to-stone-100 border-stone-200 dark:from-stone-900/40 dark:to-stone-800/30 dark:border-stone-700"
          active={kindFilter === "todas"}
          count={counts.todas}
          onClick={() => setKindFilter("todas")}
        />
        <KindFilterCard
          label="Recolha no local"
          icon={Car}
          color="from-emerald-50 to-green-100 border-emerald-200 dark:from-emerald-950/40 dark:to-emerald-900/30 dark:border-emerald-800"
          active={kindFilter === "recolha_evento"}
          count={counts.recolha_evento}
          onClick={() => setKindFilter("recolha_evento")}
        />
        <KindFilterCard
          label="Envio CTT — flores"
          icon={Box}
          color="from-sky-50 to-blue-100 border-sky-200 dark:from-sky-950/40 dark:to-blue-900/30 dark:border-sky-800"
          active={kindFilter === "envio_ctt_flores"}
          count={counts.envio_ctt_flores}
          onClick={() => setKindFilter("envio_ctt_flores")}
        />
        <KindFilterCard
          label="Envio CTT — quadro"
          icon={Frame}
          color="from-violet-50 to-purple-100 border-violet-200 dark:from-violet-950/40 dark:to-purple-900/30 dark:border-violet-800"
          active={kindFilter === "envio_ctt_quadro"}
          count={counts.envio_ctt_quadro}
          onClick={() => setKindFilter("envio_ctt_quadro")}
        />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cocoa-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Procurar por cliente, localização ou ID…"
          className="pl-9 h-9"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 items-start">
        {/* Coluna esquerda — lista de agenda (col-span-2 em desktop) */}
        <div className="lg:col-span-2">
          {totalAgendadas === 0 && buckets.concluidas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-cream-200 p-10 text-center text-sm text-cocoa-500">
              Nenhuma recolha ou envio agendado.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Atrasadas — só itens AINDA NÃO concluídos com data passada */}
              {buckets.atrasadas.length > 0 && (
                <DateGroupSection
                  title="Atrasadas"
                  subtitle="Data já passou e ainda não foram dadas como feitas"
                  tone="danger"
                  icon={AlertTriangle}
                  items={buckets.atrasadas}
                  groupByDate
                />
              )}

              {/* HOJE — destaque visual */}
              {buckets.hoje.length > 0 && (
                <TodaySection items={buckets.hoje} subtitle={todaySubtitle} />
              )}

              {/* Amanhã */}
              {buckets.amanha.length > 0 && (
                <DateGroupSection
                  title="Amanhã"
                  subtitle={tomorrowSubtitle}
                  tone="warning"
                  icon={CalendarDays}
                  items={buckets.amanha}
                />
              )}

              {/* Resto desta semana */}
              {buckets.restoSemana.length > 0 && (
                <DateGroupSection
                  title="Esta semana"
                  subtitle="Resto da semana"
                  tone="normal"
                  icon={CalendarDays}
                  items={buckets.restoSemana}
                  groupByDate
                />
              )}

              {/* Próxima semana */}
              {buckets.proximaSemana.length > 0 && (
                <DateGroupSection
                  title="Próxima semana"
                  subtitle="Já a planear"
                  tone="normal"
                  icon={CalendarDays}
                  items={buckets.proximaSemana}
                  groupByDate
                />
              )}

              {/* Mais tarde */}
              {buckets.maisTarde.length > 0 && (
                <DateGroupSection
                  title="Mais tarde"
                  subtitle="Agendamentos futuros"
                  tone="muted"
                  icon={CalendarDays}
                  items={buckets.maisTarde}
                  groupByDate
                />
              )}

              {/* Concluídas — colapsável, sem peso visual */}
              {buckets.concluidas.length > 0 && (
                <div className="rounded-2xl border border-cream-200 bg-cream-50/40 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowCompleted((v) => !v)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-cream-100/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <div>
                        <h2 className="text-sm font-semibold text-cocoa-900">
                          Concluídas
                        </h2>
                        <p className="text-[11px] text-cocoa-700">
                          Recolhas/envios já feitos (estado da encomenda confirma)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-cocoa-700">
                      <span className="font-medium">{buckets.concluidas.length}</span>
                      {showCompleted ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                  {showCompleted && (
                    <div className="divide-y divide-cream-100 border-t border-cream-200">
                      {buckets.concluidas.map((i, idx) => (
                        <LogisticsRow
                          key={`done-${i.order.id}-${i.kind}-${idx}`}
                          item={i}
                          muted
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Coluna direita — mapa sticky em desktop */}
        <aside className="lg:sticky lg:top-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-cocoa-900 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-cocoa-700" />
              Mapa
            </h2>
            <MapFilterToggle value={mapFilter} onChange={setMapFilter} />
          </div>
          <LogisticsMap markers={mapMarkers} height={520} />
        </aside>
      </div>

      {/* Calculadora de transporte — placeholder */}
      <div className="rounded-2xl border border-dashed border-cream-200 bg-cream-50 p-6 mt-8">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Construction className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-cocoa-900">
              Calculadora de transporte
            </h3>
            <p className="text-sm text-cocoa-700 leading-relaxed">
              Ferramenta para estimar custos CTT a partir do peso, destino e tipo
              de embalagem — em desenvolvimento. Por enquanto, os custos são
              registados manualmente em cada encomenda.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Segmented control para escolher o que aparece no mapa. */
function MapFilterToggle({
  value,
  onChange,
}: {
  value: MapFilter;
  onChange: (v: MapFilter) => void;
}) {
  const options: { id: MapFilter; label: string }[] = [
    { id: "recolhas", label: "Recolhas" },
    { id: "ctt", label: "CTT" },
    { id: "ambos", label: "Ambos" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-cream-200 bg-cream-50 p-0.5 text-[11px] font-medium">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "px-2.5 py-1 rounded-md transition-colors",
            value === o.id
              ? "bg-surface text-cocoa-900 shadow-sm"
              : "text-cocoa-700 hover:text-cocoa-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function KindFilterCard({
  label,
  icon: Icon,
  color,
  active,
  count,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-4 text-left transition-all hover:shadow-sm",
        color,
        active && "ring-2 ring-offset-2 ring-cocoa-900/40 shadow-sm",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cocoa-900/70" />
        <span className="text-xs uppercase tracking-wider font-semibold text-cocoa-900/80">
          {label}
        </span>
      </div>
      <div className="text-2xl font-semibold text-cocoa-900 mt-2">{count}</div>
    </button>
  );
}

/** Bloco grande "HOJE" — destaque para a pessoa que vai fazer as recolhas. */
function TodaySection({
  items,
  subtitle,
}: {
  items: LogisticsItem[];
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20 overflow-hidden shadow-sm">
      <div className="px-5 py-3 flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800 bg-white/40 dark:bg-emerald-950/30">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-sm">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
              Hoje
            </h2>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-200/70 capitalize">
              {subtitle}
            </p>
          </div>
        </div>
        <span className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
          {items.length} {items.length === 1 ? "tarefa" : "tarefas"}
        </span>
      </div>
      <div className="p-3 sm:p-4 space-y-3">
        {items.map((i, idx) => (
          <TodayCard key={`today-${i.order.id}-${i.kind}-${idx}`} item={i} />
        ))}
      </div>
    </div>
  );
}

/** Card grande para "Hoje" — info essencial em destaque (horário, local). */
function TodayCard({ item }: { item: LogisticsItem }) {
  const Icon = KIND_ICON[item.kind];
  const orderUrl = `/preservacao/${item.order.order_id ?? item.order.id}`;
  const eventDate = item.order.event_date;
  const showEventContext =
    item.kind === "recolha_evento" &&
    eventDate &&
    eventDate !== item.date;

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-surface p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* Coluna esquerda: hora grande */}
        <div className="sm:w-40 shrink-0">
          {item.timeFrom ? (
            <div className="flex items-baseline gap-1.5">
              <Clock className="h-4 w-4 text-emerald-600 self-center" />
              <div>
                <div className="text-2xl font-bold text-cocoa-900 leading-none tabular-nums">
                  {item.timeFrom.slice(0, 5)}
                </div>
                {item.timeTo && (
                  <div className="text-xs text-cocoa-700 mt-1">
                    até {item.timeTo.slice(0, 5)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs italic text-cocoa-500">
              <Clock className="h-3 w-3" />
              Sem horário definido
            </span>
          )}
        </div>

        {/* Coluna direita: local + cliente + tipo */}
        <div className="flex-1 min-w-0 space-y-2">
          <LocationLine location={item.location} large />
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Link
              href={orderUrl}
              className="font-medium text-cocoa-900 hover:underline"
            >
              {item.order.client_name}
            </Link>
            <span className="text-[10px] uppercase tracking-wider rounded-full bg-cream-100 text-cocoa-700 px-1.5 py-0.5 font-mono">
              {item.order.order_id}
            </span>
            {item.order.event_type && (
              <span className="text-xs text-cocoa-700">
                · {EVENT_TYPE_LABELS[item.order.event_type]}
              </span>
            )}
          </div>
          {showEventContext && (
            <div className="text-xs text-cocoa-700 flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              Evento foi {format(parseISO(eventDate!), "EEEE, dd/MM/yyyy", { locale: pt })}
            </div>
          )}
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border bg-gradient-to-br px-2 py-0.5 text-[11px] font-medium",
              KIND_COLORS[item.kind],
            )}
          >
            <Icon className="h-3 w-3" />
            {KIND_LABELS[item.kind]}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Secção para um bucket de datas (atrasadas, amanhã, esta semana, etc.) */
function DateGroupSection({
  title,
  subtitle,
  tone,
  icon: Icon,
  items,
  groupByDate = false,
}: {
  title: string;
  subtitle: string;
  tone: "danger" | "warning" | "normal" | "muted";
  icon: React.ComponentType<{ className?: string }>;
  items: LogisticsItem[];
  groupByDate?: boolean;
}) {
  const toneStyles: Record<typeof tone, string> = {
    danger:
      "border-red-200 bg-red-50/40 dark:bg-red-950/20 dark:border-red-900",
    warning:
      "border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900",
    normal: "border-cream-200 bg-surface",
    muted: "border-cream-200 bg-cream-50",
  };
  const iconColor: Record<typeof tone, string> = {
    danger: "text-red-600",
    warning: "text-amber-600",
    normal: "text-cocoa-700",
    muted: "text-cocoa-500",
  };

  // Agrupa por data se pedido
  const groupedByDate = useMemo(() => {
    if (!groupByDate) return null;
    const map = new Map<string, LogisticsItem[]>();
    for (const i of items) {
      const list = map.get(i.date) ?? [];
      list.push(i);
      map.set(i.date, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items, groupByDate]);

  return (
    <div className={cn("rounded-2xl border overflow-hidden", toneStyles[tone])}>
      <div className="px-4 py-2.5 border-b border-inherit flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4 self-center", iconColor[tone])} />
          <div>
            <h2 className="text-sm font-semibold text-cocoa-900 capitalize">
              {title}
            </h2>
            <p className="text-[11px] text-cocoa-700">{subtitle}</p>
          </div>
        </div>
        <span className="text-xs font-medium text-cocoa-700">
          {items.length}
        </span>
      </div>

      {groupedByDate ? (
        <div className="divide-y divide-cream-100">
          {groupedByDate.map(([date, dayItems]) => (
            <div key={date}>
              <div className="px-4 py-1.5 bg-cream-50/50 text-[11px] font-semibold uppercase tracking-wider text-cocoa-700 capitalize">
                {format(parseISO(date), "EEEE · dd/MM/yyyy", { locale: pt })}
              </div>
              <div className="divide-y divide-cream-100">
                {dayItems.map((i, idx) => (
                  <LogisticsRow key={`${i.order.id}-${i.kind}-${idx}`} item={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-cream-100">
          {items.map((i, idx) => (
            <LogisticsRow key={`${i.order.id}-${i.kind}-${idx}`} item={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function LogisticsRow({
  item,
  muted = false,
}: {
  item: LogisticsItem;
  muted?: boolean;
}) {
  const Icon = KIND_ICON[item.kind];
  const orderUrl = `/preservacao/${item.order.order_id ?? item.order.id}`;
  const eventDate = item.order.event_date;
  const showEventContext =
    item.kind === "recolha_evento" && eventDate && eventDate !== item.date;

  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 hover:bg-cream-50 transition-colors",
        muted && "opacity-70",
      )}
    >
      {/* Ícone do tipo */}
      <div
        className={cn(
          "h-9 w-9 rounded-lg border bg-gradient-to-br flex items-center justify-center shrink-0 mt-0.5",
          KIND_COLORS[item.kind],
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Hora (coluna fixa em desktop) */}
      <div className="w-20 shrink-0 hidden sm:block pt-0.5">
        {item.timeFrom ? (
          <div>
            <div className="text-sm font-semibold text-cocoa-900 tabular-nums">
              {item.timeFrom.slice(0, 5)}
            </div>
            {item.timeTo && (
              <div className="text-[10px] text-cocoa-500 tabular-nums">
                até {item.timeTo.slice(0, 5)}
              </div>
            )}
          </div>
        ) : (
          <span className="text-[10px] italic text-cocoa-500">sem hora</span>
        )}
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        {/* Hora em mobile (inline) */}
        {item.timeFrom && (
          <div className="text-xs font-semibold text-cocoa-900 sm:hidden mb-0.5 tabular-nums">
            {item.timeFrom.slice(0, 5)}
            {item.timeTo && ` – ${item.timeTo.slice(0, 5)}`}
          </div>
        )}

        <LocationLine location={item.location} />

        <div className="text-xs text-cocoa-700 mt-1 flex items-center gap-2 flex-wrap">
          <Link
            href={orderUrl}
            className="font-medium text-cocoa-900 hover:underline"
          >
            {item.order.client_name}
          </Link>
          <span className="text-[10px] uppercase tracking-wider rounded-full bg-cream-100 text-cocoa-700 px-1.5 py-0.5 font-mono">
            {item.order.order_id}
          </span>
          {item.order.event_type && (
            <span className="text-[11px]">
              · {EVENT_TYPE_LABELS[item.order.event_type]}
            </span>
          )}
        </div>

        {showEventContext && (
          <div className="text-[11px] text-cocoa-500 mt-1 flex items-center gap-1 capitalize">
            <CalendarDays className="h-3 w-3" />
            Evento: {format(parseISO(eventDate!), "EEEE, dd/MM/yyyy", { locale: pt })}
          </div>
        )}
      </div>

      <span
        className={cn(
          "text-[10px] uppercase tracking-wider shrink-0 hidden md:inline mt-1 px-2 py-0.5 rounded-full border bg-gradient-to-br",
          KIND_COLORS[item.kind],
        )}
      >
        {KIND_LABELS[item.kind]}
      </span>
    </div>
  );
}

/** Linha de localização — clicável abre no Google Maps. */
function LocationLine({
  location,
  large = false,
}: {
  location: string;
  large?: boolean;
}) {
  const hasLocation = location && location !== "—";
  if (!hasLocation) {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 italic text-cocoa-500",
          large ? "text-sm" : "text-xs",
        )}
      >
        <MapPin className={cn(large ? "h-4 w-4" : "h-3 w-3")} />
        Localização por definir
      </div>
    );
  }
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-start gap-1.5 text-cocoa-900 hover:text-blue-700 hover:underline group",
        large ? "text-base font-semibold" : "text-sm font-medium",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <MapPin
        className={cn(
          "shrink-0 text-cocoa-700 group-hover:text-blue-600 mt-0.5",
          large ? "h-4 w-4" : "h-3.5 w-3.5",
        )}
      />
      <span className="break-words">{location}</span>
      <ExternalLink
        className={cn(
          "shrink-0 opacity-0 group-hover:opacity-60 mt-0.5",
          large ? "h-3.5 w-3.5" : "h-3 w-3",
        )}
      />
    </a>
  );
}
