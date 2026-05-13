import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { groupOrders } from "@/lib/supabase/orders";
import type { Order } from "@/types/database";
import PreservacaoClient from "./preservacao-client";

export default async function PreservacaoPage() {
  const supabase = await createClient();
  const role = await getCurrentRole();

  const [activeRes, archivedRes, vouchersRes] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .is("deleted_at", null)
      .order("event_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("orders")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    // Vouchers ativos (mínimo: code + id) para podermos ligar encomendas
    // ao vale que as originou via order.gift_voucher_code === voucher.code.
    supabase
      .from("vouchers")
      .select("id, code")
      .is("deleted_at", null),
  ]);

  const orders: Order[] = (activeRes.data ?? []) as Order[];
  const archivedOrders: Order[] = (archivedRes.data ?? []) as Order[];
  const voucherCodeToId = new Map<string, string>(
    ((vouchersRes.data ?? []) as { id: string; code: string }[]).map((v) => [v.code, v.id]),
  );
  const grouped = groupOrders(orders);

  return (
    <PreservacaoClient
      initialOrders={orders}
      initialGrouped={grouped}
      archivedOrders={archivedOrders}
      canEdit={role === "admin"}
      voucherCodeToId={Object.fromEntries(voucherCodeToId)}
    />
  );
}
