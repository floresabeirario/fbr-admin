import "server-only";
import { upsertOrderEvent, deleteOrderEvent } from "./calendar";
import { loadIntegration } from "./oauth";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderStatus, PaymentStatus } from "@/types/database";

/**
 * Decide quando o Calendar precisa de mexer numa encomenda. Regras
 * (decididas com a Maria na sessão 38):
 *
 *  - Cria evento ao 1º pagamento (mesma trigger do Drive).
 *  - Actualiza se mudar `event_date`, `client_name`, `event_type`,
 *    `couple_names` ou `event_location` (e já houver evento).
 *  - Apaga se passar para `cancelado` (e havia evento).
 *  - Cria também via botão manual no workbench (sem depender de pagamento).
 */

async function isGoogleConnected(): Promise<boolean> {
  try {
    const integration = await loadIntegration();
    return !!integration?.refresh_token;
  } catch {
    return false;
  }
}

type OrderFields = Pick<
  Order,
  | "id"
  | "order_id"
  | "client_name"
  | "event_date"
  | "event_type"
  | "couple_names"
  | "event_location"
  | "calendar_event_id"
  | "status"
  | "flower_delivery_method"
  | "pickup_address"
  | "pickup_date"
  | "pickup_time_from"
  | "pickup_time_to"
  | "pickup_notes"
  | "email"
  | "phone"
  | "contact_preference"
>;

export function isFirstOrderPaymentTransition(
  prev: PaymentStatus | null | undefined,
  next: PaymentStatus | null | undefined,
): boolean {
  if (!prev || !next) return false;
  return prev === "100_por_pagar" && next !== "100_por_pagar";
}

export function statusBecomesCancelled(
  prev: OrderStatus | null | undefined,
  next: OrderStatus | null | undefined,
): boolean {
  if (!next) return false;
  return next === "cancelado" && prev !== "cancelado";
}

/**
 * Verifica se algum campo "visível no evento" mudou — usado para decidir
 * se vale a pena actualizar um evento que já existe. Inclui campos de
 * recolha e contactos do cliente (sessão 46).
 */
export function calendarFieldsChanged(
  prev: Partial<OrderFields>,
  updates: Partial<OrderFields>,
): boolean {
  const fields: (keyof OrderFields)[] = [
    "event_date",
    "client_name",
    "event_type",
    "couple_names",
    "event_location",
    "flower_delivery_method",
    "pickup_address",
    "pickup_date",
    "pickup_time_from",
    "pickup_time_to",
    "pickup_notes",
    "email",
    "phone",
    "contact_preference",
  ];
  return fields.some(
    (f) => updates[f] !== undefined && updates[f] !== prev[f],
  );
}

/**
 * Cria ou actualiza o evento Calendar de uma encomenda e persiste o
 * `calendar_event_id` na linha. Não rebenta em caso de erro — loga e
 * devolve null, para a Maria poder retentar manualmente no workbench.
 */
export async function upsertOrderCalendarEvent(
  order: OrderFields,
): Promise<{ id: string; htmlLink: string | null } | null> {
  if (!order.event_date) return null;
  if (!(await isGoogleConnected())) return null;

  try {
    const result = await upsertOrderEvent({
      id: order.id,
      order_id: order.order_id,
      client_name: order.client_name,
      event_date: order.event_date,
      event_type: order.event_type,
      event_location: order.event_location,
      couple_names: order.couple_names,
      calendar_event_id: order.calendar_event_id,
      flower_delivery_method: order.flower_delivery_method,
      pickup_address: order.pickup_address,
      pickup_date: order.pickup_date,
      pickup_time_from: order.pickup_time_from,
      pickup_time_to: order.pickup_time_to,
      pickup_notes: order.pickup_notes,
      email: order.email,
      phone: order.phone,
      contact_preference: order.contact_preference,
    });
    if (!result) return null;

    // Só fazemos update se o ID mudou (insert novo, ou recriação após 404)
    if (result.id !== order.calendar_event_id) {
      const supabase = await createClient();
      await supabase
        .from("orders")
        .update({ calendar_event_id: result.id })
        .eq("id", order.id);
    }
    return result;
  } catch (err) {
    console.error("[calendar] Erro a criar/actualizar evento:", err);
    return null;
  }
}

/**
 * Apaga o evento Calendar associado a uma encomenda (se existir) e
 * limpa o `calendar_event_id` na linha. Silencioso em caso de erro.
 */
export async function deleteOrderCalendarEvent(
  order: Pick<Order, "id" | "calendar_event_id">,
): Promise<boolean> {
  if (!order.calendar_event_id) return false;
  if (!(await isGoogleConnected())) return false;

  try {
    await deleteOrderEvent(order.calendar_event_id);
  } catch (err) {
    console.error("[calendar] Erro a apagar evento:", err);
    // Continuamos para limpar o ID — se o evento estiver lá, a Maria pode
    // apagá-lo manualmente; pior é ter o ID a apontar para nada.
  }

  const supabase = await createClient();
  await supabase
    .from("orders")
    .update({ calendar_event_id: null })
    .eq("id", order.id);
  return true;
}
