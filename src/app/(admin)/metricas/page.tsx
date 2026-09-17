import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import type { StatusHistoryRow, ResponseTimeRow } from "@/lib/metrics";
import MetricasClient from "./metricas-client";

export const dynamic = "force-dynamic";

export default async function MetricasPage() {
  const supabase = await createClient();

  // Histórico de estados e tempo de resposta vêm da mig 113. Se ainda não
  // correu, o Supabase devolve erro (tabela/função em falta) e ficamos com
  // listas vazias: os cartões dizem "sem dados" em vez de a página rebentar.
  const [ordersRes, vouchersRes, partnersRes, historyRes, responseRes] = await Promise.all([
    supabase.from("orders").select("*").is("deleted_at", null),
    supabase.from("vouchers").select("*").is("deleted_at", null),
    supabase
      .from("partners")
      .select("id, name, category")
      .is("deleted_at", null),
    supabase
      .from("order_status_history")
      .select("order_id, from_status, to_status, changed_at"),
    supabase.rpc("whatsapp_first_response"),
  ]);

  const orders: Order[] = (ordersRes.data ?? []) as Order[];
  const vouchers: Voucher[] = (vouchersRes.data ?? []) as Voucher[];
  const statusHistory = (historyRes.data ?? []) as StatusHistoryRow[];
  const responseTimes = (responseRes.data ?? []) as ResponseTimeRow[];

  type PartnerLite = { id: string; name: string; category: string };
  const partnersList = (partnersRes.data ?? []) as PartnerLite[];
  const partnerNames: Record<string, string> = {};
  for (const p of partnersList) partnerNames[p.id] = p.name;

  return (
    <MetricasClient
      initialOrders={orders}
      initialVouchers={vouchers}
      partnerNames={partnerNames}
      statusHistory={statusHistory}
      responseTimes={responseTimes}
      loadedAt={new Date().toISOString()}
    />
  );
}
