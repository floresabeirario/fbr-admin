"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Truck,
  CalendarClock,
  MapPin,
  ChevronRight,
  Filter,
  Package,
  Flower2,
  ArrowDownToLine,
  Construction,
  Search,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { pt } from "date-fns/locale";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Order } from "@/types/database";

type LogisticsKind = "recolha_evento" | "envio_ctt_flores" | "envio_ctt_quadro";

interface LogisticsItem {
  order: Order;
  date: string;
  kind: LogisticsKind;
  location: string;
  /** Janela horária (apenas recolha_evento) */
  timeFrom?: string | null;
  timeTo?: string | null;
}

const KIND_LABELS: Record<LogisticsKind, string> = {
  recolha_evento: "Recolha no local",
  envio_ctt_flores: "Envio CTT — flores",
  envio_ctt_quadro: "Envio CTT — quadro",
};

const KIND_COLORS: Record<LogisticsKind, string> = {
  recolha_evento: "from-emerald-50 to-green-100 border-emerald-300 text-emerald-900",
  envio_ctt_flores: "from-sky-50 to-blue-100 border-sky-300 text-sky-900",
  envio_ctt_quadro: "from-violet-50 to-purple-100 border-violet-300 text-violet-900",
};

const KIND_ICON: Record<LogisticsKind, React.ComponentType<{ className?: string }>> = {
  recolha_evento: Flower2,
  envio_ctt_flores: ArrowDownToLine,
  envio_ctt_quadro: Package,
};

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
      items.push({
        order: o,
        date,
        kind: "recolha_evento",
        location: o.pickup_address ?? o.event_location ?? "—",
        timeFrom: o.pickup_time_from,
        timeTo: o.pickup_time_to,
      });
    }

    // Envio CTT flores (date = event_date)
    if (
      o.flower_delivery_method === "ctt" &&
      o.event_date &&
      ["entrega_agendada", "flores_enviadas"].includes(o.status)
    ) {
      items.push({
        order: o,
        date: o.event_date,
        kind: "envio_ctt_flores",
        location: o.event_location ?? "—",
      });
    }

    // Envio CTT quadro
    const frameSendDate = o.frame_delivery_date ?? o.estimated_delivery_date;
    if (
      o.frame_delivery_method === "ctt" &&
      frameSendDate &&
      ["quadro_pronto", "quadro_enviado", "quadro_recebido"].includes(o.status)
    ) {
      items.push({
        order: o,
        date: frameSendDate,
        kind: "envio_ctt_quadro",
        location: o.event_location ?? "—",
      });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

type FilterKind = "todas" | LogisticsKind;

export default function EntregasRecolhasClient({ orders }: { orders: Order[] }) {
  const [kindFilter, setKindFilter] = useState<FilterKind>("todas");
  const [search, setSearch] = useState("");

  const allItems = useMemo(() => getAllLogistics(orders), [orders]);

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

  // Agrupa em 4 buckets temporais (relativo a hoje).
  const buckets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const acc = {
      atrasadas: [] as LogisticsItem[],
      proximos7: [] as LogisticsItem[],
      proximos30: [] as LogisticsItem[],
      futuras: [] as LogisticsItem[],
    };
    for (const i of filtered) {
      const days = differenceInDays(parseISO(i.date), today);
      if (days < 0) acc.atrasadas.push(i);
      else if (days <= 7) acc.proximos7.push(i);
      else if (days <= 30) acc.proximos30.push(i);
      else acc.futuras.push(i);
    }
    return acc;
  }, [filtered]);

  const counts = useMemo(() => {
    return {
      todas: allItems.length,
      recolha_evento: allItems.filter((i) => i.kind === "recolha_evento").length,
      envio_ctt_flores: allItems.filter((i) => i.kind === "envio_ctt_flores").length,
      envio_ctt_quadro: allItems.filter((i) => i.kind === "envio_ctt_quadro").length,
    };
  }, [allItems]);

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
            Vista completa de recolhas no local e envios CTT (flores + quadros)
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KindFilterCard
          label="Todas"
          icon={Filter}
          color="from-stone-50 to-stone-100 border-stone-200"
          active={kindFilter === "todas"}
          count={counts.todas}
          onClick={() => setKindFilter("todas")}
        />
        <KindFilterCard
          label="Recolha no local"
          icon={Flower2}
          color="from-emerald-50 to-green-100 border-emerald-200"
          active={kindFilter === "recolha_evento"}
          count={counts.recolha_evento}
          onClick={() => setKindFilter("recolha_evento")}
        />
        <KindFilterCard
          label="Envio CTT — flores"
          icon={ArrowDownToLine}
          color="from-sky-50 to-blue-100 border-sky-200"
          active={kindFilter === "envio_ctt_flores"}
          count={counts.envio_ctt_flores}
          onClick={() => setKindFilter("envio_ctt_flores")}
        />
        <KindFilterCard
          label="Envio CTT — quadro"
          icon={Package}
          color="from-violet-50 to-purple-100 border-violet-200"
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

      {/* Listagem agrupada por janela temporal */}
      <div className="space-y-5">
        <BucketSection
          title="Atrasadas"
          subtitle="Data já passou — verificar"
          tone="danger"
          items={buckets.atrasadas}
        />
        <BucketSection
          title="Próximos 7 dias"
          subtitle="Esta semana"
          tone="warning"
          items={buckets.proximos7}
        />
        <BucketSection
          title="8–30 dias"
          subtitle="Este mês"
          tone="normal"
          items={buckets.proximos30}
        />
        <BucketSection
          title="Mais de 30 dias"
          subtitle="Agendamentos futuros"
          tone="muted"
          items={buckets.futuras}
        />
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

function BucketSection({
  title,
  subtitle,
  tone,
  items,
}: {
  title: string;
  subtitle: string;
  tone: "danger" | "warning" | "normal" | "muted";
  items: LogisticsItem[];
}) {
  const toneStyles: Record<typeof tone, string> = {
    danger: "border-red-200 bg-red-50/40 dark:bg-red-950/20",
    warning: "border-amber-200 bg-amber-50/40 dark:bg-amber-950/20",
    normal: "border-cream-200 bg-surface",
    muted: "border-cream-200 bg-cream-50",
  };
  return (
    <div className={cn("rounded-2xl border overflow-hidden", toneStyles[tone])}>
      <div className="px-4 py-2.5 border-b border-inherit flex items-baseline justify-between">
        <div>
          <h2 className="text-sm font-semibold text-cocoa-900">
            {title}
          </h2>
          <p className="text-[11px] text-cocoa-700">{subtitle}</p>
        </div>
        <span className="text-xs font-medium text-cocoa-700">
          {items.length === 0 ? "Nenhum" : items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-cocoa-500">—</div>
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

function LogisticsRow({ item }: { item: LogisticsItem }) {
  const Icon = KIND_ICON[item.kind];
  const orderUrl = `/preservacao/${item.order.order_id ?? item.order.id}`;
  return (
    <Link
      href={orderUrl}
      className="flex items-center gap-3 px-4 py-3 hover:bg-cream-50 transition-colors"
    >
      <div
        className={cn(
          "h-9 w-9 rounded-lg border bg-gradient-to-br flex items-center justify-center shrink-0",
          KIND_COLORS[item.kind],
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-cocoa-900 truncate">
          {item.order.client_name}
          <span className="text-[10px] uppercase tracking-wider rounded-full bg-cream-100 text-cocoa-700 px-1.5 py-0.5 font-mono">
            {item.order.order_id}
          </span>
        </div>
        <div className="text-xs text-cocoa-700 flex items-center gap-3 mt-0.5">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {format(parseISO(item.date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: pt })}
            {item.timeFrom && (
              <>
                {" · "}
                {item.timeFrom.slice(0, 5)}
                {item.timeTo && `–${item.timeTo.slice(0, 5)}`}
              </>
            )}
          </span>
          <span className="inline-flex items-center gap-1 truncate">
            <MapPin className="h-3 w-3" />
            {item.location}
          </span>
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-cocoa-700 shrink-0 hidden sm:inline">
        {KIND_LABELS[item.kind]}
      </span>
      <ChevronRight className="h-4 w-4 text-cocoa-500 shrink-0" />
    </Link>
  );
}
