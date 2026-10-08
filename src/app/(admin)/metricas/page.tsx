import { createClient } from "@/lib/supabase/server";
import type { Order, OrderPayment } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import type { StatusHistoryRow, ResponseTimeRow } from "@/lib/metrics";
import MetricasClient from "./metricas-client";

export const dynamic = "force-dynamic";

export default async function MetricasPage() {
  const supabase = await createClient();

  // Histórico de estados e tempo de resposta vêm da mig 113. Se ainda não
  // correu, o Supabase devolve erro (tabela/função em falta) e ficamos com
  // listas vazias: os cartões dizem "sem dados" em vez de a página rebentar.
  const [ordersRes, vouchersRes, partnersRes, historyRes, responseRes, paymentsRes] = await Promise.all([
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
    supabase.from("order_payments").select("order_id, amount, paid_at"),
  ]);

  // Livro de pagamentos anexado a cada encomenda (mig 114): a receita das
  // Métricas conta pela data de cada pagamento, como nas Finanças.
  type PaymentLite = Pick<OrderPayment, "order_id" | "amount" | "paid_at">;
  const paymentsByOrder = new Map<string, PaymentLite[]>();
  for (const p of (paymentsRes.data ?? []) as PaymentLite[]) {
    const list = paymentsByOrder.get(p.order_id);
    if (list) list.push(p);
    else paymentsByOrder.set(p.order_id, [p]);
  }
  const orders: Order[] = ((ordersRes.data ?? []) as Order[]).map((o) => ({
    ...o,
    payments: paymentsByOrder.get(o.id) ?? [],
  }));
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
