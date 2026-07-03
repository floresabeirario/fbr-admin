// Tipos e helpers partilhados entre o workbench-client e os cartões
// extraídos em _components/. Sem JSX — só contratos e derivações puras.

import { format, parseISO, differenceInCalendarDays } from "date-fns";
import type { Order, OrderUpdate } from "@/types/database";
import { relativeMonthsDays } from "@/lib/format-date";
import { isEventAlertRelevant } from "../../_styles";

/** Actualização com autosave (debounce 900ms) — vive no workbench-client. */
export type UpdateFn = <K extends keyof OrderUpdate>(
  key: K,
  value: OrderUpdate[K],
) => void;

/** Como UpdateFn, mas para campos preenchidos pelo cliente: abre um diálogo
 *  de confirmação antes de aplicar (protege contra cliques acidentais). */
export type ClientUpdateFn = <K extends keyof OrderUpdate>(
  key: K,
  newValue: OrderUpdate[K],
  label: string,
  formatter?: (v: OrderUpdate[K]) => string,
) => void;

/** Outra encomenda do mesmo cliente (mesmo email/telemóvel). Só
 *  informativo — avisa com link, NUNCA bloqueia (regra da Maria). */
export type DuplicateOrderInfo = {
  id: string;
  order_id: string;
  client_name: string;
  status: Order["status"];
  event_date: string | null;
  matchedBy: string;
};

export function toDateInput(val: string | null | undefined): string {
  if (!val) return "";
  try { return format(parseISO(val), "yyyy-MM-dd"); } catch { return ""; }
}

/** Alertas de proximidade/atraso do evento — usados no header e no hero. */
export function computeEventFlags(local: Order) {
  const daysUntilEvent = local.event_date
    ? differenceInCalendarDays(parseISO(local.event_date), new Date())
    : null;
  const eventAlertRelevant = isEventAlertRelevant(local.status);
  const overdueEvent =
    eventAlertRelevant && daysUntilEvent !== null && daysUntilEvent < 0;
  const soonEvent =
    eventAlertRelevant &&
    daysUntilEvent !== null &&
    daysUntilEvent >= 0 &&
    daysUntilEvent <= 5;
  const isWedding = local.event_type === "casamento";
  const eventRelative = local.event_date ? relativeMonthsDays(local.event_date) : null;
  return { daysUntilEvent, overdueEvent, soonEvent, isWedding, eventRelative };
}

/** Visibilidade dos slots de fatura + alerta de fatura em falta — usados
 *  no cartão Finanças e no alerta da coluna do meio. */
export function computeInvoiceFlags(local: Order) {
  const hasAnyPayment = ["100_pago", "70_pago", "30_pago"].includes(local.payment_status);
  // Slots de fatura visíveis consoante o pagamento. Como o esquema de
  // pagamento real (30/40/30 vs 70/30 vs 100%) não está fixado no
  // payment_status, mostramos todos os slots possíveis no nível actual:
  //   30%  → sinal
  //   70%  → sinal + intermédio (mantém-se o intermédio mesmo no caso 70/30,
  //          a Maria simplesmente não preenche)
  //   100% → sinal + intermédio + final
  const invoiceSlotsVisible = {
    sinal: hasAnyPayment,
    intermedio: ["100_pago", "70_pago"].includes(local.payment_status),
    final: local.payment_status === "100_pago",
  };
  const missingInvoice =
    hasAnyPayment &&
    local.needs_invoice &&
    !local.invoice_url_sinal &&
    !local.invoice_url_intermedio &&
    !local.invoice_url_final;
  return { hasAnyPayment, invoiceSlotsVisible, missingInvoice };
}
