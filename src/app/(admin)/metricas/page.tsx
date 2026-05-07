import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import MetricasClient from "./metricas-client";

export const dynamic = "force-dynamic";

export default async function MetricasPage() {
  const supabase = await createClient();

  const [ordersRes, vouchersRes] = await Promise.all([
    supabase.from("orders").select("*").is("deleted_at", null),
    supabase.from("vouchers").select("*").is("deleted_at", null),
  ]);

  const orders: Order[] = (ordersRes.data ?? []) as Order[];
  const vouchers: Voucher[] = (vouchersRes.data ?? []) as Voucher[];

  return (
    <MetricasClient
      initialOrders={orders}
      initialVouchers={vouchers}
      loadedAt={new Date().toISOString()}
    />
  );
}
