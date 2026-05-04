import { createClient } from "./client";
import type { Order, OrderInsert, OrderUpdate, OrderStatus } from "@/types/database";
import { differenceInDays } from "date-fns";
import { generateCouponCode } from "@/lib/coupon";

// ── Leitura ───────────────────────────────────────────────────

export async function getOrders(): Promise<Order[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Order[];
}

export async function getOrderById(id: string): Promise<Order | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) return null;
  return data as Order;
}

export async function getOrderByOrderId(orderId: string): Promise<Order | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_id", orderId)
    .is("deleted_at", null)
    .single();

  if (error) return null;
  return data as Order;
}

// ── Escrita ───────────────────────────────────────────────────

export async function createOrder(order: OrderInsert): Promise<Order> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .insert(order)
    .select()
    .single();

  if (error) throw error;
  return data as Order;
}

export async function updateOrder(id: string, updates: OrderUpdate): Promise<Order> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Order;
}

// Soft delete
export async function deleteOrder(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("orders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

// Mudar estado
export async function updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  const updates: OrderUpdate = { status };

  // Ao passar para "A ser emoldurado" → gerar cupão 5%
  if (status === "a_ser_emoldurado") {
    updates.coupon_code = generateCouponCode();
    updates.coupon_status = "nao_utilizado";
  }

  return updateOrder(id, updates);
}

// ── Lógica de grupos ──────────────────────────────────────────

const SEM_RESPOSTA_DAYS = 4;

export function isWithoutResponse(order: Order): boolean {
  if (order.status !== "entrega_flores_agendar") return false;
  if (order.contacted) return false;
  if (order.manually_no_response) return true;
  const days = differenceInDays(new Date(), new Date(order.created_at));
  return days >= SEM_RESPOSTA_DAYS;
}

// Ordena por data do evento ascendente (mais próxima primeiro);
// encomendas sem data ficam no fim.
function byEventDateAsc(a: Order, b: Order): number {
  if (!a.event_date && !b.event_date) return 0;
  if (!a.event_date) return 1;
  if (!b.event_date) return -1;
  return a.event_date.localeCompare(b.event_date);
}

// Agrupa as encomendas para a vista de tabela
export function groupOrders(orders: Order[]) {
  const sorted = [...orders].sort(byEventDateAsc);
  const semResposta = sorted.filter(isWithoutResponse);
  const semRespostaIds = new Set(semResposta.map((o) => o.id));

  return {
    pre_reservas: sorted.filter(
      (o) =>
        o.status === "entrega_flores_agendar" && !semRespostaIds.has(o.id)
    ),
    sem_resposta: semResposta,
    reservas: sorted.filter((o) =>
      ["entrega_agendada", "flores_enviadas", "flores_recebidas"].includes(o.status)
    ),
    preservacao_design: sorted.filter((o) =>
      [
        "flores_na_prensa",
        "reconstrucao_botanica",
        "a_compor_design",
        "a_aguardar_aprovacao",
      ].includes(o.status)
    ),
    finalizacao: sorted.filter((o) =>
      [
        "a_ser_emoldurado",
        "emoldurado",
        "a_ser_fotografado",
        "quadro_pronto",
        "quadro_enviado",
      ].includes(o.status)
    ),
    concluidos: sorted.filter((o) => o.status === "quadro_recebido"),
    cancelamentos: sorted.filter((o) => o.status === "cancelado"),
  };
}

