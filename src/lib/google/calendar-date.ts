import type { Order } from "@/types/database";

/**
 * Regra da data do evento Calendar — pura, partilhada entre o servidor
 * (`lib/google/calendar.ts`) e o workbench (para saber se o botão
 * "Evento Calendar" pode estar activo). Vive fora de `calendar.ts`
 * porque esse módulo é `server-only`.
 */

export type CalendarDateFields = Pick<
  Order,
  "event_date" | "flower_delivery_method" | "pickup_date" | "hand_delivery_date"
>;

/**
 * Data em que o evento deve aparecer no Calendar. Ordem de prioridade:
 *
 *   1. Data de recolha / entrega em mãos, quando é esse o método de envio
 *      — é o dia em que há trabalho a fazer, não o dia do casamento.
 *   2. `event_date` (o caso normal da preservação).
 *   3. Qualquer data de entrega preenchida, mesmo que o método de envio
 *      ainda não esteja marcado.
 *
 * O passo 3 é o que faz as encomendas de **flores secas** funcionarem: esse
 * form não pergunta data do evento (as flores já estão secas), por isso a
 * única data que existe é a da entrega das flores. Sem ele, nenhuma
 * encomenda de secas chegava a gerar evento (sessão 154).
 */
export function effectiveCalendarDate(order: CalendarDateFields): string | null {
  if (order.flower_delivery_method === "recolha_evento" && order.pickup_date) {
    return order.pickup_date;
  }
  if (order.flower_delivery_method === "maos" && order.hand_delivery_date) {
    return order.hand_delivery_date;
  }
  return order.event_date ?? order.pickup_date ?? order.hand_delivery_date ?? null;
}

/**
 * A encomenda não tinha nenhuma data utilizável e passa a ter. Nas
 * encomendas de flores secas é este o momento que substitui o "1º
 * pagamento" como gatilho: o form não pede data do evento, por isso a
 * encomenda só fica agendável quando a Maria marca a entrega das flores.
 */
export function calendarDateBecomesAvailable(
  prev: CalendarDateFields,
  next: CalendarDateFields,
): boolean {
  return !effectiveCalendarDate(prev) && !!effectiveCalendarDate(next);
}
