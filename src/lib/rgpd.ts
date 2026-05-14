import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";

export const RETENTION_YEARS = 10;
export const RETENTION_ALERT_MONTHS = 6;

export type ClientSearchResult = {
  query: string;
  orders: Order[];
  vouchers: Voucher[];
};

/**
 * Procura todas as encomendas e vales associados a um email ou telefone.
 * Pesquisa case-insensitive. Considera:
 *  - orders.email, orders.phone
 *  - vouchers.sender_email, vouchers.sender_phone, vouchers.recipient_contact
 *
 * Inclui registos arquivados (deleted_at) mas NÃO anonimizados — por
 * definição, anonimizados já não têm PII associável.
 */
export async function searchClientData(query: string): Promise<ClientSearchResult> {
  const supabase = await createClient();
  const trimmed = query.trim();
  if (!trimmed) return { query: trimmed, orders: [], vouchers: [] };

  const pattern = `%${trimmed}%`;

  const [{ data: orders }, { data: vouchers }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .is("anonymized_at", null)
      .or(`email.ilike.${pattern},phone.ilike.${pattern}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("vouchers")
      .select("*")
      .is("anonymized_at", null)
      .or(
        `sender_email.ilike.${pattern},sender_phone.ilike.${pattern},recipient_contact.ilike.${pattern}`,
      )
      .order("created_at", { ascending: false }),
  ]);

  return {
    query: trimmed,
    orders: (orders ?? []) as Order[],
    vouchers: (vouchers ?? []) as Voucher[],
  };
}

// ── Retenção fiscal (10 anos) ────────────────────────────────

export type RetentionStatus =
  | "expired"     // já passou dos 10 anos — apagar agora
  | "due_soon"    // faltam ≤6 meses para o prazo
  | "future";     // ainda dentro do prazo

export function retentionDeadline(referenceDate: string | null): Date | null {
  if (!referenceDate) return null;
  const ref = new Date(referenceDate);
  if (Number.isNaN(ref.getTime())) return null;
  const deadline = new Date(ref);
  deadline.setFullYear(deadline.getFullYear() + RETENTION_YEARS);
  return deadline;
}

export function retentionStatus(deadline: Date | null, now = new Date()): RetentionStatus | null {
  if (!deadline) return null;
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return "expired";
  const alertWindow = RETENTION_ALERT_MONTHS * 30 * 24 * 60 * 60 * 1000;
  if (ms <= alertWindow) return "due_soon";
  return "future";
}

export type OrderRetentionRow = {
  order: Order;
  reference: string; // data usada (frame_delivery_date)
  deadline: Date;
  status: RetentionStatus;
};

/**
 * Lista encomendas concluídas (status=quadro_recebido) cuja data de
 * entrega + 10 anos está dentro de RETENTION_ALERT_MONTHS, OU já passou.
 * Exclui anonimizadas e arquivadas.
 */
export async function listOrdersDueForRetention(): Promise<OrderRetentionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .is("anonymized_at", null)
    .is("deleted_at", null)
    .eq("status", "quadro_recebido")
    .not("frame_delivery_date", "is", null)
    .order("frame_delivery_date", { ascending: true });

  if (error) throw new Error(error.message);

  const rows: OrderRetentionRow[] = [];
  for (const order of (data ?? []) as Order[]) {
    const deadline = retentionDeadline(order.frame_delivery_date);
    if (!deadline) continue;
    const status = retentionStatus(deadline);
    if (status === "expired" || status === "due_soon") {
      rows.push({
        order,
        reference: order.frame_delivery_date!,
        deadline,
        status,
      });
    }
  }
  return rows;
}
