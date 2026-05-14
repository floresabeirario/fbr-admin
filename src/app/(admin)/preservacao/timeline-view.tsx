"use client";

import { useState, useMemo } from "react";
import {
  parseISO,
  format,
  isPast,
  startOfDay,
  differenceInCalendarDays,
} from "date-fns";
import { pt } from "date-fns/locale";
import {
  ChevronDown,
  ChevronRight,
  CalendarDays,
  AlertTriangle,
  Loader2,
  ExternalLink,
  MapPin,
} from "lucide-react";
import {
  type Order,
  EVENT_TYPE_LABELS,
  STATUS_LABELS,
} from "@/types/database";
import { STATUS_COLORS, STATUS_DOT_COLORS } from "./_styles";

interface Props {
  orders: Order[];
  onOpenOrder: (o: Order) => void;
  loadingOrderId: string | null;
}

type Bucket = {
  // Chave do mês: yyyy-MM (para ordenação) + label legível
  key: string;
  label: string;
  monthDate: Date;
  orders: Order[];
};

function bucketByMonth(orders: Order[]): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const o of orders) {
    if (!o.event_date) continue;
    let date: Date;
    try {
      date = parseISO(o.event_date);
    } catch {
      continue;
    }
    const key = format(date, "yyyy-MM");
    const existing = map.get(key);
    if (existing) {
      existing.orders.push(o);
    } else {
      map.set(key, {
        key,
        label: format(date, "MMMM 'de' yyyy", { locale: pt }),
        monthDate: new Date(date.getFullYear(), date.getMonth(), 1),
        orders: [o],
      });
    }
  }
  // Ordena encomendas dentro de cada bucket por data ascendente
  for (const b of map.values()) {
    b.orders.sort((a, c) => (a.event_date! < c.event_date! ? -1 : 1));
  }
  return Array.from(map.values());
}

export default function TimelineView({ orders, onOpenOrder, loadingOrderId }: Props) {
  const today = startOfDay(new Date());

  // Separa em futuras (incl. hoje) e passadas, com base em event_date
  const { future, past, missingDate } = useMemo(() => {
    const f: Order[] = [];
    const p: Order[] = [];
    const md: Order[] = [];
    for (const o of orders) {
      if (!o.event_date) {
        md.push(o);
        continue;
      }
      try {
        const d = parseISO(o.event_date);
        if (isPast(d) && d.getTime() < today.getTime()) p.push(o);
        else f.push(o);
      } catch {
        md.push(o);
      }
    }
    // Futuro: ascendente (mais próximo primeiro)
    f.sort((a, b) => (a.event_date! < b.event_date! ? -1 : 1));
    // Passado: descendente (mais recente primeiro)
    p.sort((a, b) => (a.event_date! > b.event_date! ? -1 : 1));
    return { future: f, past: p, missingDate: md };
  }, [orders, today]);

  const futureBuckets = useMemo(() => {
    const buckets = bucketByMonth(future);
    buckets.sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());
    return buckets;
  }, [future]);

  const pastBuckets = useMemo(() => {
    const buckets = bucketByMonth(past);
    buckets.sort((a, b) => b.monthDate.getTime() - a.monthDate.getTime());
    return buckets;
  }, [past]);

  // Passado colapsado por defeito
  const [showPast, setShowPast] = useState(false);
  const [showMissing, setShowMissing] = useState(false);

  const hasFuture = futureBuckets.length > 0;

  return (
    <div className="space-y-6">
      {/* Próximos eventos */}
      <section>
        <header className="flex items-center gap-2 mb-3">
          <CalendarDays className="h-4 w-4 text-cocoa-900" />
          <h2 className="text-sm font-semibold text-cocoa-900">Próximos eventos</h2>
          <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-medium text-cocoa-700">
            {future.length}
          </span>
        </header>

        {!hasFuture ? (
          <p className="rounded-xl border border-dashed border-cream-200 bg-surface px-4 py-6 text-center text-xs text-cocoa-500 italic">
            Sem eventos futuros agendados.
          </p>
        ) : (
          <div className="space-y-5">
            {futureBuckets.map((bucket) => (
              <BucketSection
                key={bucket.key}
                bucket={bucket}
                onOpenOrder={onOpenOrder}
                loadingOrderId={loadingOrderId}
                today={today}
              />
            ))}
          </div>
        )}
      </section>

      {/* Eventos passados (colapsado) */}
      {pastBuckets.length > 0 && (
        <section>
          <button
            onClick={() => setShowPast((s) => !s)}
            className="w-full flex items-center gap-2 mb-3 text-left"
          >
            {showPast ? (
              <ChevronDown className="h-4 w-4 text-cocoa-700" />
            ) : (
              <ChevronRight className="h-4 w-4 text-cocoa-700" />
            )}
            <h2 className="text-sm font-semibold text-cocoa-700">Eventos passados</h2>
            <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-medium text-cocoa-700">
              {past.length}
            </span>
          </button>
          {showPast && (
            <div className="space-y-5">
              {pastBuckets.map((bucket) => (
                <BucketSection
                  key={bucket.key}
                  bucket={bucket}
                  onOpenOrder={onOpenOrder}
                  loadingOrderId={loadingOrderId}
                  today={today}
                  past
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Sem data definida */}
      {missingDate.length > 0 && (
        <section>
          <button
            onClick={() => setShowMissing((s) => !s)}
            className="w-full flex items-center gap-2 mb-3 text-left"
          >
            {showMissing ? (
              <ChevronDown className="h-4 w-4 text-cocoa-700" />
            ) : (
              <ChevronRight className="h-4 w-4 text-cocoa-700" />
            )}
            <h2 className="text-sm font-semibold text-cocoa-700">Sem data de evento</h2>
            <span className="rounded-full bg-cream-100 px-2 py-0.5 text-xs font-medium text-cocoa-700">
              {missingDate.length}
            </span>
          </button>
          {showMissing && (
            <div className="rounded-xl border border-cream-200 bg-surface divide-y divide-cream-100">
              {missingDate.map((o) => (
                <TimelineRow
                  key={o.id}
                  order={o}
                  onOpenOrder={onOpenOrder}
                  loadingOrderId={loadingOrderId}
                  showDate={false}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Secção por mês ────────────────────────────────────────────

function BucketSection({
  bucket,
  onOpenOrder,
  loadingOrderId,
  today,
  past = false,
}: {
  bucket: Bucket;
  onOpenOrder: (o: Order) => void;
  loadingOrderId: string | null;
  today: Date;
  past?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <span
          className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${
            past ? "text-cocoa-500" : "text-cocoa-700"
          } capitalize`}
        >
          {bucket.label}
        </span>
        <span className="text-[10px] text-cocoa-500">
          · {bucket.orders.length} evento{bucket.orders.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="rounded-xl border border-cream-200 bg-surface divide-y divide-cream-100 overflow-hidden">
        {bucket.orders.map((o) => (
          <TimelineRow
            key={o.id}
            order={o}
            onOpenOrder={onOpenOrder}
            loadingOrderId={loadingOrderId}
            today={today}
            past={past}
          />
        ))}
      </div>
    </div>
  );
}

// ── Linha individual ──────────────────────────────────────────

function TimelineRow({
  order,
  onOpenOrder,
  loadingOrderId,
  today,
  past = false,
  showDate = true,
}: {
  order: Order;
  onOpenOrder: (o: Order) => void;
  loadingOrderId: string | null;
  today?: Date;
  past?: boolean;
  showDate?: boolean;
}) {
  const isLoading = loadingOrderId === order.id;
  const eventDate = order.event_date ? parseISO(order.event_date) : null;
  const daysAway =
    eventDate && today ? differenceInCalendarDays(eventDate, today) : null;
  const urgent = daysAway !== null && daysAway >= 0 && daysAway <= 5;

  return (
    <button
      onClick={() => onOpenOrder(order)}
      className={`w-full flex items-stretch gap-3 px-3 py-2.5 text-left transition-colors ${
        isLoading ? "bg-[#FAF3E8]" : "hover:bg-cream-50"
      }`}
    >
      {/* Coluna data */}
      {showDate && eventDate ? (
        <div
          className={`flex flex-col items-center justify-center w-14 shrink-0 rounded-lg px-2 py-1.5 ${
            past
              ? "bg-stone-100 text-stone-500"
              : urgent
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-cream-50 text-cocoa-900 border border-cream-200"
          }`}
        >
          <span className="text-[9px] uppercase font-semibold tracking-wider opacity-70">
            {format(eventDate, "MMM", { locale: pt })}
          </span>
          <span className="text-lg leading-none font-bold">
            {format(eventDate, "d")}
          </span>
          <span className="text-[9px] capitalize opacity-70">
            {format(eventDate, "EEE", { locale: pt })}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-center w-14 shrink-0 rounded-lg bg-cream-100 text-cocoa-500">
          <CalendarDays className="h-4 w-4" />
        </div>
      )}

      {/* Coluna info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-cocoa-900 truncate">
            {order.client_name}
          </span>
          {order.event_type && (
            <span className="text-xs text-cocoa-700">
              {EVENT_TYPE_LABELS[order.event_type]}
            </span>
          )}
          {urgent && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
              <AlertTriangle className="h-2.5 w-2.5" />
              {daysAway === 0 ? "Hoje" : `${daysAway}d`}
            </span>
          )}
        </div>
        {order.event_location && (
          <div className="flex items-center gap-1 text-[11px] text-cocoa-700 truncate">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{order.event_location}</span>
          </div>
        )}
      </div>

      {/* Coluna estado */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[order.status]}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[order.status]}`} />
          {STATUS_LABELS[order.status]}
        </span>
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#C4A882]" />
        ) : (
          <ExternalLink className="h-3.5 w-3.5 text-[#C4A882]" />
        )}
      </div>
    </button>
  );
}
