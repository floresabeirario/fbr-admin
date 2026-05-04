import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { groupOrders } from "@/lib/supabase/orders";
import type { Order } from "@/types/database";
import PreservacaoClient from "./preservacao-client";

export default async function PreservacaoPage() {
  const supabase = await createClient();
  const role = await getCurrentRole();

  const { data } = await supabase
    .from("orders")
    .select("*")
    .is("deleted_at", null)
    .order("event_date", { ascending: true, nullsFirst: false });

  const orders: Order[] = (data ?? []) as Order[];
  const grouped = groupOrders(orders);

  return (
    <PreservacaoClient
      initialOrders={orders}
      initialGrouped={grouped}
      canEdit={role === "admin"}
    />
  );
}
