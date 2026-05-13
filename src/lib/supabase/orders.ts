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

// ── Single source of truth: estado → grupo ────────────────────
// Todos os OrderStatus têm de estar mapeados aqui. Se um estado
// novo for adicionado a `OrderStatus` e esquecido aqui, o TypeScript
// dá erro de compilação por causa do `Record<OrderStatus, …>` —
// é deliberado, é a salvaguarda principal contra "encomendas que
// desaparecem". Não substituir por `Partial<Record<…>>` nem
// `Record<string, …>`: a exaustividade é o que mantém isto seguro.
export type OrderGroupKey =
  | "pre_reservas"
  | "sem_resposta"
  | "reservas"
  | "preservacao_design"
  | "finalizacao"
  | "concluidos"
  | "cancelamentos";

const STATUS_TO_GROUP: Record<OrderStatus, OrderGroupKey> = {
  entrega_flores_agendar: "pre_reservas", // sem_resposta é derivado em runtime
  entrega_agendada:       "reservas",
  flores_enviadas:        "reservas",
  flores_recebidas:       "reservas",
  flores_na_prensa:       "preservacao_design",
  reconstrucao_botanica:  "preservacao_design",
  a_compor_design:        "preservacao_design",
  a_aguardar_aprovacao:   "preservacao_design",
  a_finalizar_quadro:     "preservacao_design",
  a_ser_emoldurado:       "finalizacao",
  emoldurado:             "finalizacao",
  a_ser_fotografado:      "finalizacao",
  quadro_pronto:          "finalizacao",
  quadro_enviado:         "finalizacao",
  quadro_recebido:        "concluidos",
  cancelado:              "cancelamentos",
};

// Agrupa as encomendas para a vista de tabela.
// Devolve também `orfas`: encomendas com status que não mapeia para
// nenhum grupo (não pode acontecer em runtime se TS estiver feliz,
// mas pode acontecer se a BD tiver um valor que o TS não conhece —
// ex.: migração nova que ainda não chegou ao código). A UI mostra-as
// num grupo de alerta vermelho "Sem grupo" em vez de as esconder.
export function groupOrders(orders: Order[]): Record<OrderGroupKey, Order[]> & { orfas: Order[] } {
  const sorted = [...orders].sort(byEventDateAsc);

  const buckets: Record<OrderGroupKey, Order[]> & { orfas: Order[] } = {
    pre_reservas: [],
    sem_resposta: [],
    reservas: [],
    preservacao_design: [],
    finalizacao: [],
    concluidos: [],
    cancelamentos: [],
    orfas: [],
  };

  for (const order of sorted) {
    if (isWithoutResponse(order)) {
      buckets.sem_resposta.push(order);
      continue;
    }
    const group = STATUS_TO_GROUP[order.status];
    if (!group) {
      // Defensivo: estado desconhecido vindo da BD. Nunca esconder.
      buckets.orfas.push(order);
      if (typeof window !== "undefined" && typeof console !== "undefined") {
        console.error(
          `[orders] Encomenda ${order.order_id} tem estado desconhecido "${order.status}". ` +
            `Adicione um mapeamento em STATUS_TO_GROUP.`,
        );
      }
      continue;
    }
    buckets[group].push(order);
  }

  return buckets;
}

