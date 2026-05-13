import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { groupOrders } from "@/lib/supabase/orders";
import type { Order } from "@/types/database";
import PreservacaoClient from "./preservacao-client";

export default async function PreservacaoPage() {
  const supabase = await createClient();
  const role = await getCurrentRole();

  const [activeRes, archivedRes] = await Promise.all([
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
  ]);

  const orders: Order[] = (activeRes.data ?? []) as Order[];
  const archivedOrders: Order[] = (archivedRes.data ?? []) as Order[];
  const grouped = groupOrders(orders);

  return (
    <PreservacaoClient
      initialOrders={orders}
      initialGrouped={grouped}
      archivedOrders={archivedOrders}
      canEdit={role === "admin"}
    />
  );
}
