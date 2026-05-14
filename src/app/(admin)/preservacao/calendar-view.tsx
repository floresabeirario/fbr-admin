"use client";

import { useState, useMemo } from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
  parseISO,
} from "date-fns";
import { pt } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  type Order,
  EVENT_TYPE_LABELS,
  STATUS_LABELS,
} from "@/types/database";
import { STATUS_DOT_COLORS } from "./_styles";

interface Props {
  orders: Order[];
  onOpenOrder: (o: Order) => void;
  loadingOrderId: string | null;
}

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MAX_VISIBLE = 3;

export default function CalendarView({ orders, onOpenOrder, loadingOrderId }: Props) {
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // Pré-calcula os dias da grelha (semana começa à segunda)
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  // Indexa encomendas por chave de dia (yyyy-MM-dd) para lookup rápido
  const ordersByDay = useMemo(() => {
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
  }, [orders]);

  // Conta quantos eventos caem dentro do mês visível (não as outside-days)
  const eventsInMonth = useMemo(() => {
    let n = 0;
    for (const [key, arr] of ordersByDay) {
      const d = parseISO(key);
      if (isSameMonth(d, cursor)) n += arr.length;
    }
    return n;
  }, [ordersByDay, cursor]);

  return (
    <div className="rounded-xl border border-cream-200 bg-surface overflow-hidden">
      {/* Header de navegação */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-cream-100 bg-cream-50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor((c) => subMonths(c, 1))}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-cream-200 bg-surface text-cocoa-700 hover:bg-cream-100 transition-colors"
            title="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-cream-200 bg-surface text-cocoa-700 hover:bg-cream-100 transition-colors"
            title="Mês seguinte"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="ml-1 h-7 px-2.5 inline-flex items-center rounded-md border border-cream-200 bg-surface text-xs font-medium text-cocoa-900 hover:bg-cream-100 transition-colors"
          >
            Hoje
          </button>
        </div>
        <div className="flex flex-col items-center">
          <h2 className="text-sm font-semibold text-cocoa-900 capitalize">
            {format(cursor, "MMMM 'de' yyyy", { locale: pt })}
          </h2>
          <p className="text-[11px] text-cocoa-700">
            {eventsInMonth === 0
              ? "Sem eventos"
              : `${eventsInMonth} evento${eventsInMonth === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="w-[148px]" /> {/* spacer para centrar o título */}
      </div>

      {/* Cabeçalho de dias da semana */}
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

      {/* Grelha de dias */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const key = format(day, "yyyy-MM-dd");
          const dayOrders = ordersByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const expanded = expandedDay === key;
          const visible = expanded ? dayOrders : dayOrders.slice(0, MAX_VISIBLE);
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
              {/* Número do dia */}
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

              {/* Eventos do dia */}
              <div className="flex flex-col gap-0.5">
                {visible.map((o) => {
                  const isLoading = loadingOrderId === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => onOpenOrder(o)}
                      title={`${o.client_name}${
                        o.event_type ? ` · ${EVENT_TYPE_LABELS[o.event_type]}` : ""
                      } · ${STATUS_LABELS[o.status]}`}
                      className={`group flex items-center gap-1 rounded px-1.5 py-0.5 text-left text-[11px] truncate border transition-colors ${
                        isLoading
                          ? "border-cocoa-500 bg-[#FAF3E8]"
                          : "border-transparent hover:border-cream-200 hover:bg-cream-50"
                      }`}
                    >
                      {isLoading ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0 text-cocoa-700" />
                      ) : (
                        <span
                          className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT_COLORS[o.status]}`}
                        />
                      )}
                      <span className="truncate text-cocoa-900 font-medium">
                        {o.client_name}
                      </span>
                    </button>
                  );
                })}

                {!expanded && hidden > 0 && (
                  <button
                    onClick={() => setExpandedDay(key)}
                    className="text-left text-[10px] font-medium text-cocoa-700 hover:text-cocoa-900 px-1.5"
                  >
                    +{hidden} mais
                  </button>
                )}
                {expanded && dayOrders.length > MAX_VISIBLE && (
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

      {/* Legenda compacta de cores */}
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
      </div>
    </div>
  );
}
