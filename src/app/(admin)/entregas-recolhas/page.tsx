import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/types/database";
import EntregasRecolhasClient from "./entregas-recolhas-client";

export const dynamic = "force-dynamic";

export default async function EntregasRecolhasPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select("*")
    .is("deleted_at", null)
    .order("event_date", { ascending: true, nullsFirst: false });

  const orders: Order[] = (data ?? []) as Order[];

  return <EntregasRecolhasClient orders={orders} />;
}
