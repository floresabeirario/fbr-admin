import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import type { Order } from "@/types/database";
import type { PartialPublicMessages } from "@/lib/public-status";
import StatusClient from "./status-client";

export default async function StatusPage() {
  const supabase = await createClient();
  const role = await getCurrentRole();

  const [ordersRes, settingsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .is("deleted_at", null)
      .order("event_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("public_status_settings")
      .select("messages")
      .eq("id", 1)
      .single(),
  ]);

  const orders: Order[] = (ordersRes.data ?? []) as Order[];
  const defaultMessages: PartialPublicMessages =
    (settingsRes.data?.messages as PartialPublicMessages) ?? {};

  return (
    <StatusClient
      initialOrders={orders}
      initialDefaults={defaultMessages}
      canEdit={role === "admin"}
    />
  );
}
