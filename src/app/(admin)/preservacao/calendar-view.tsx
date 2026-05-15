"use client";

import { useState, useMemo } from "react";
import {
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addYears,
  subYears,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  eachMonthOfInterval,
  isSameMonth,
  isToday,
  format,
  parseISO,
} from "date-fns";
import { pt } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Truck,
  Hand,
  Mail,
  MessageCircle,
  MapPin,
  ExternalLink,
  Clock,
} from "lucide-react";
import {
  type Order,
  EVENT_TYPE_LABELS,
  STATUS_LABELS,
  FLOWER_DELIVERY_METHOD_LABELS,
} from "@/types/database";
import { STATUS_DOT_COLORS, STATUS_COLORS } from "./_styles";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Props {
  orders: Order[];
  onOpenOrder: (o: Order) => void;
  loadingOrderId: string | null;
}

type ViewMode = "week" | "month" | "year";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MAX_VISIBLE_MONTH = 3;

// ── Helpers ────────────────────────────────────────────────────

// Distingue os 2 sinais logísticos que a equipa precisa de saber a olho:
// • recolha_evento → equipa precisa deslocar-se ao evento
// • maos          → cliente entrega em mãos (sem deslocação)
// CTT e "não sei" ficam sem ícone (não há acção da equipa).
function deliveryBadge(o: Order): { icon: typeof Truck; color: string; label: string } | null {
  switch (o.flower_delivery_method) {
    case "recolha_evento":
      return { icon: Truck, color: "text-rose-600", label: "Recolha no local — equipa desloca-se" };
    case "maos":
      return { icon: Hand, color: "text-sky-600", label: "Entrega em mãos pelo cliente" };
    default:
      return null;
  }
}

// Formata HH:MM (descarta segundos se vierem do Postgres TIME)
function formatTime(t: string | null): string | null {
  if (!t) return null;
  const m = t.match(/^(\d{2}:\d{2})/);
  return m ? m[1] : t;
}

function indexByDay(orders: Order[]): Map<string, Order[]> {
  const map = new Map<string, Order[]>();
  for (const o of orders) {
    if (!o.event_date) continue;
    try {
      const key = format(parseISO(o.event_date), "yyyy-MM-dd");
      const arr = map.get(key);
      if (arr) arr.push(o);
      else map.set(key, [o]);
    } catch {
      // ignora datas inválidas
    }
  }
  return map;
}

// ── Componente ─────────────────────────────────────────────────

export default function CalendarView({ orders, onOpenOrder, loadingOrderId }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());

  const ordersByDay = useMemo(() => indexByDay(orders), [orders]);

  // Navegação contextual: avança/recua consoante o modo
  const goPrev = () => setCursor((c) => (viewMode === "week" ? subWeeks(c, 1) : viewMode === "month" ? subMonths(c, 1) : subYears(c, 1)));
  const goNext = () => setCursor((c) => (viewMode === "week" ? addWeeks(c, 1) : viewMode === "month" ? addMonths(c, 1) : addYears(c, 1)));
  const goToday = () => setCursor(new Date());

  const headerTitle = useMemo(() => {
    if (viewMode === "year") return format(cursor, "yyyy");
    if (viewMode === "month") return format(cursor, "MMMM 'de' yyyy", { locale: pt });
    // Semana: "1 - 7 de Junho 2026"
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    const end = endOfWeek(cursor, { weekStartsOn: 1 });
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, "d")} – ${format(end, "d 'de' MMMM yyyy", { locale: pt })}`;
    }
    return `${format(start, "d 'de' MMM", { locale: pt })} – ${format(end, "d 'de' MMM yyyy", { locale: pt })}`;
  }, [cursor, viewMode]);

  return (
    <div className="rounded-xl border border-cream-200 bg-surface overflow-hidden">
      {/* Header de navegação */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-cream-100 bg-cream-50">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-cream-200 bg-surface text-cocoa-700 hover:bg-cream-100 transition-colors"
            title={viewMode === "week" ? "Semana anterior" : viewMode === "month" ? "Mês anterior" : "Ano anterior"}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goNext}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-cream-200 bg-surface text-cocoa-700 hover:bg-cream-100 transition-colors"
            title={viewMode === "week" ? "Semana seguinte" : viewMode === "month" ? "Mês seguinte" : "Ano seguinte"}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="ml-1 h-7 px-2.5 inline-flex items-center rounded-md border border-cream-200 bg-surface text-xs font-medium text-cocoa-900 hover:bg-cream-100 transition-colors"
          >
            Hoje
          </button>
        </div>

        <h2 className="text-sm font-semibold text-cocoa-900 capitalize">{headerTitle}</h2>

        {/* Switcher Semana / Mês / Ano */}
        <div className="inline-flex rounded-md border border-cream-200 bg-surface p-0.5">
          {(["week", "month", "year"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`h-6 px-2.5 text-[11px] font-medium rounded transition-colors ${
                viewMode === v
                  ? "bg-cream-100 text-cocoa-900"
                  : "text-cocoa-700 hover:bg-cream-50"
              }`}
            >
              {v === "week" ? "Semana" : v === "month" ? "Mês" : "Ano"}
            </button>
          ))}
        </div>
      </div>

      {viewMode === "month" && (
        <MonthView
          cursor={cursor}
          ordersByDay={ordersByDay}
          onOpenOrder={onOpenOrder}
          loadingOrderId={loadingOrderId}
        />
      )}
      {viewMode === "week" && (
        <WeekView
          cursor={cursor}
          ordersByDay={ordersByDay}
          onOpenOrder={onOpenOrder}
          loadingOrderId={loadingOrderId}
        />
      )}
      {viewMode === "year" && (
        <YearView
          cursor={cursor}
          ordersByDay={ordersByDay}
          onMonthClick={(d) => {
            setCursor(d);
            setViewMode("month");
          }}
        />
      )}

      {/* Legenda compacta */}
      <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1.5 px-4 py-3 border-t border-cream-100 bg-cream-50">
        {(
          [
            { label: "Pré-reserva", status: "entrega_flores_agendar" },
            { label: "Reserva", status: "entrega_agendada" },
            { label: "Preservação", status: "flores_na_prensa" },
            { label: "Finalização", status: "a_ser_emoldurado" },
            { label: "Concluído", status: "quadro_recebido" },
            { label: "Cancelado", status: "cancelado" },
          ] as const
        ).map(({ label, status }) => (
          <span
            key={status}
            className="inline-flex items-center gap-1.5 text-[10px] text-cocoa-700"
          >
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT_COLORS[status]}`} />
            {label}
          </span>
        ))}
        {/* Ícones logísticos */}
        <span className="inline-flex items-center gap-1.5 text-[10px] text-cocoa-700 ml-2">
          <Truck className="h-3 w-3 text-rose-600" /> Recolha
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-cocoa-700">
          <Hand className="h-3 w-3 text-sky-600" /> Entrega em mãos
        </span>
      </div>
    </div>
  );
}

// ── Vista Mês ──────────────────────────────────────────────────

function MonthView({
  cursor,
  ordersByDay,
  onOpenOrder,
  loadingOrderId,
}: {
  cursor: Date;
  ordersByDay: Map<string, Order[]>;
  onOpenOrder: (o: Order) => void;
  loadingOrderId: string | null;
}) {
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  return (
    <>
      <div className="grid grid-cols-7 border-b border-cream-100 bg-cream-50">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-[11px] font-medium uppercase tracking-wide text-cocoa-700 text-center"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const key = format(day, "yyyy-MM-dd");
          const dayOrders = ordersByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const expanded = expandedDay === key;
          const visible = expanded ? dayOrders : dayOrders.slice(0, MAX_VISIBLE_MONTH);
          const hidden = dayOrders.length - visible.length;
          const isLastCol = (idx + 1) % 7 === 0;
          const isLastRow = idx >= days.length - 7;

          return (
            <div
              key={key}
              className={`min-h-[110px] p-1.5 flex flex-col gap-1 ${
                inMonth ? "bg-surface" : "bg-cream-50"
              } ${!isLastCol ? "border-r border-cream-100" : ""} ${
                !isLastRow ? "border-b border-cream-100" : ""
              }`}
            >
              <div className="flex items-center justify-end">
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-medium ${
                    today
                      ? "bg-btn-primary text-btn-primary-fg"
                      : inMonth
                      ? "text-cocoa-900"
                      : "text-[#C4B6A6]"
                  }`}
                >
                  {format(day, "d")}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                {visible.map((o) => (
                  <EventChip
                    key={o.id}
                    order={o}
                    onOpenOrder={onOpenOrder}
                    isLoading={loadingOrderId === o.id}
                  />
                ))}

                {!expanded && hidden > 0 && (
                  <button
                    onClick={() => setExpandedDay(key)}
                    className="text-left text-[10px] font-medium text-cocoa-700 hover:text-cocoa-900 px-1.5"
                  >
                    +{hidden} mais
                  </button>
                )}
                {expanded && dayOrders.length > MAX_VISIBLE_MONTH && (
                  <button
                    onClick={() => setExpandedDay(null)}
                    className="text-left text-[10px] font-medium text-cocoa-700 hover:text-cocoa-900 px-1.5"
                  >
                    mostrar menos
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Vista Semana ───────────────────────────────────────────────

function WeekView({
  cursor,
  ordersByDay,
  onOpenOrder,
  loadingOrderId,
}: {
  cursor: Date;
  ordersByDay: Map<string, Order[]>;
  onOpenOrder: (o: Order) => void;
  loadingOrderId: string | null;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    const end = endOfWeek(cursor, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-7">
      {days.map((day, idx) => {
        const key = format(day, "yyyy-MM-dd");
        const dayOrders = ordersByDay.get(key) ?? [];
        const today = isToday(day);
        const isLastCol = idx === days.length - 1;

        return (
          <div
            key={key}
            className={`min-h-[260px] p-2.5 flex flex-col gap-2 bg-surface ${
              !isLastCol ? "sm:border-r border-cream-100" : ""
            } border-b sm:border-b-0 border-cream-100`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-cocoa-700 font-medium">
                {format(day, "EEE", { locale: pt })}
              </span>
              <span
                className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-semibold ${
                  today
                    ? "bg-btn-primary text-btn-primary-fg"
                    : "text-cocoa-900"
                }`}
              >
                {format(day, "d")}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              {dayOrders.length === 0 ? (
                <span className="text-[11px] text-[#C4B6A6] italic">—</span>
              ) : (
                dayOrders.map((o) => (
                  <EventChip
                    key={o.id}
                    order={o}
                    onOpenOrder={onOpenOrder}
                    isLoading={loadingOrderId === o.id}
                    variant="detailed"
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Vista Ano (heatmap) ────────────────────────────────────────

function YearView({
  cursor,
  ordersByDay,
  onMonthClick,
}: {
  cursor: Date;
  ordersByDay: Map<string, Order[]>;
  onMonthClick: (d: Date) => void;
}) {
  const months = useMemo(() => {
    return eachMonthOfInterval({ start: startOfYear(cursor), end: endOfYear(cursor) });
  }, [cursor]);

  // Max events em qualquer dia do ano — para normalizar a intensidade do heatmap
  const maxPerDay = useMemo(() => {
    let max = 0;
    for (const [k, arr] of ordersByDay) {
      if (parseISO(k).getFullYear() === cursor.getFullYear() && arr.length > max) {
        max = arr.length;
      }
    }
    return max;
  }, [ordersByDay, cursor]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
      {months.map((m) => (
        <MiniMonth
          key={m.toISOString()}
          month={m}
          ordersByDay={ordersByDay}
          maxPerDay={maxPerDay}
          onClick={() => onMonthClick(m)}
        />
      ))}
    </div>
  );
}

function MiniMonth({
  month,
  ordersByDay,
  maxPerDay,
  onClick,
}: {
  month: Date;
  ordersByDay: Map<string, Order[]>;
  maxPerDay: number;
  onClick: () => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const monthTotal = useMemo(() => {
    let n = 0;
    for (const [k, arr] of ordersByDay) {
      if (isSameMonth(parseISO(k), month)) n += arr.length;
    }
    return n;
  }, [ordersByDay, month]);

  return (
    <button
      onClick={onClick}
      className="rounded-lg border border-cream-200 bg-surface p-3 text-left hover:border-cocoa-500 hover:shadow-sm transition-all"
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold text-cocoa-900 capitalize">
          {format(month, "MMM", { locale: pt })}
        </span>
        {monthTotal > 0 && (
          <span className="text-[10px] text-cocoa-700">
            {monthTotal} evento{monthTotal === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            className="text-[8px] text-[#C4B6A6] text-center font-medium uppercase"
          >
            {w[0]}
          </span>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const count = ordersByDay.get(key)?.length ?? 0;
          const inMonth = isSameMonth(day, month);
          const today = isToday(day);
          return (
            <span
              key={key}
              className={`aspect-square rounded-sm text-[8px] flex items-center justify-center font-medium ${
                today ? "ring-1 ring-cocoa-500" : ""
              } ${inMonth ? heatmapClass(count, maxPerDay) : "text-[#E8E0D5]"}`}
              title={
                count > 0
                  ? `${format(day, "d 'de' MMMM", { locale: pt })} — ${count} evento${count === 1 ? "" : "s"}`
                  : format(day, "d 'de' MMMM", { locale: pt })
              }
            >
              {inMonth ? format(day, "d") : ""}
            </span>
          );
        })}
      </div>
    </button>
  );
}

// Mapa de intensidade → tons quentes de rosé/cocoa para combinar com a brand.
// Em vez de bolinhas, todo o quadrado pinta — mais "heatmap".
function heatmapClass(count: number, max: number): string {
  if (count === 0) return "bg-cream-50 text-[#C4B6A6]";
  if (max === 0) return "bg-cream-50 text-[#C4B6A6]";
  const ratio = count / max;
  if (ratio <= 0.25) return "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200";
  if (ratio <= 0.5) return "bg-rose-200 text-rose-900 dark:bg-rose-900/70 dark:text-rose-100";
  if (ratio <= 0.75) return "bg-rose-400 text-white dark:bg-rose-700 dark:text-rose-50";
  return "bg-rose-600 text-white dark:bg-rose-600 dark:text-white";
}

// ── Chip de evento (partilhado por Mês e Semana) ───────────────

function EventChip({
  order: o,
  onOpenOrder,
  isLoading,
  variant = "compact",
}: {
  order: Order;
  onOpenOrder: (o: Order) => void;
  isLoading: boolean;
  variant?: "compact" | "detailed";
}) {
  const delivery = deliveryBadge(o);
  const DeliveryIcon = delivery?.icon;

  return (
    <Popover>
      <PopoverTrigger
        title={`${o.client_name}${
          o.event_type ? ` · ${EVENT_TYPE_LABELS[o.event_type]}` : ""
        } · ${STATUS_LABELS[o.status]}`}
        className={`group flex items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] truncate border transition-colors ${
          isLoading
            ? "border-cocoa-500 bg-[#FAF3E8]"
            : "border-transparent hover:border-cream-200 hover:bg-cream-50"
        } ${variant === "detailed" ? "py-1" : ""}`}
      >
        {isLoading ? (
          <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0 text-cocoa-700" />
        ) : (
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT_COLORS[o.status]}`}
          />
        )}
        {DeliveryIcon && (
          <DeliveryIcon className={`h-3 w-3 shrink-0 ${delivery.color}`} />
        )}
        <span className="truncate text-cocoa-900 font-medium">{o.client_name}</span>
        {variant === "detailed" && o.event_type && (
          <span className="text-[10px] text-cocoa-700 truncate">
            · {EVENT_TYPE_LABELS[o.event_type]}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <EventPopoverBody order={o} onOpenOrder={onOpenOrder} />
      </PopoverContent>
    </Popover>
  );
}

function EventPopoverBody({
  order: o,
  onOpenOrder,
}: {
  order: Order;
  onOpenOrder: (o: Order) => void;
}) {
  const delivery = deliveryBadge(o);
  const DeliveryIcon = delivery?.icon;
  const isPickup = o.flower_delivery_method === "recolha_evento";
  const pickupFrom = formatTime(o.pickup_time_from);
  const pickupTo = formatTime(o.pickup_time_to);

  return (
    <div className="space-y-2.5">
      {/* Header: nome + tipo */}
      <div className="space-y-0.5">
        <div className="font-semibold text-cocoa-900 text-sm leading-tight">
          {o.client_name}
        </div>
        {o.event_type && (
          <div className="text-[11px] text-cocoa-700">
            {EVENT_TYPE_LABELS[o.event_type]}
            {o.couple_names ? ` · ${o.couple_names}` : ""}
          </div>
        )}
      </div>

      {/* Estado */}
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${STATUS_COLORS[o.status]}`}
      >
        {STATUS_LABELS[o.status]}
      </span>

      {/* Contactos */}
      <div className="space-y-1 text-[11px]">
        {o.email && (
          <a
            href={`mailto:${o.email}`}
            className="flex items-center gap-1.5 text-cocoa-700 hover:text-cocoa-900 transition-colors"
          >
            <Mail className="h-3 w-3 text-blue-500 shrink-0" />
            <span className="truncate">{o.email}</span>
          </a>
        )}
        {o.phone && (
          <a
            href={`https://wa.me/${o.phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-cocoa-700 hover:text-cocoa-900 transition-colors"
          >
            <MessageCircle className="h-3 w-3 text-green-500 shrink-0" />
            <span className="font-mono">{o.phone}</span>
          </a>
        )}
      </div>

      {/* Localização do evento */}
      {o.event_location && (
        <div className="flex items-start gap-1.5 text-[11px] text-cocoa-700">
          <MapPin className="h-3 w-3 text-orange-500 shrink-0 mt-0.5" />
          <span>{o.event_location}</span>
        </div>
      )}

      {/* Logística — destacada com fundo */}
      {delivery && (
        <div
          className={`rounded-md border p-2 text-[11px] ${
            isPickup
              ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40"
              : "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40"
          }`}
        >
          <div className="flex items-center gap-1.5 font-medium mb-1">
            {DeliveryIcon && <DeliveryIcon className={`h-3.5 w-3.5 ${delivery.color}`} />}
            <span className={isPickup ? "text-rose-900 dark:text-rose-200" : "text-sky-900 dark:text-sky-200"}>
              {FLOWER_DELIVERY_METHOD_LABELS[o.flower_delivery_method!]}
            </span>
          </div>
          {isPickup && (
            <div className="space-y-0.5 text-cocoa-700">
              {o.pickup_address && (
                <div className="flex items-start gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                  <span>{o.pickup_address}</span>
                </div>
              )}
              {(pickupFrom || pickupTo) && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>
                    {pickupFrom ?? "?"}
                    {pickupTo ? ` – ${pickupTo}` : ""}
                  </span>
                </div>
              )}
              {!o.pickup_address && !pickupFrom && (
                <p className="italic text-cocoa-500">Detalhes de recolha por preencher.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Botão abrir */}
      <button
        type="button"
        onClick={() => onOpenOrder(o)}
        className="w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-md bg-btn-primary text-btn-primary-fg text-xs font-medium hover:bg-btn-primary-hover transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        Abrir encomenda
      </button>
    </div>
  );
}
