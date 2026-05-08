import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Partner } from "@/types/partner";
import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import PartnerWorkbenchClient from "./workbench-client";

export default async function PartnerWorkbenchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isUuid) notFound();

  const [partnerRes, ordersRes, vouchersRes] = await Promise.all([
    supabase
      .from("partners")
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("orders")
      .select("id, order_id, client_name, event_date, status, budget, created_at")
      .eq("partner_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("vouchers")
      .select("id, code, sender_name, recipient_name, amount, payment_status, usage_status, created_at")
      .eq("partner_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  if (partnerRes.error || !partnerRes.data) notFound();

  const partner = partnerRes.data as Partner;
  const orders = (ordersRes.data ?? []) as Pick<Order, "id" | "order_id" | "client_name" | "event_date" | "status" | "budget" | "created_at">[];
  const vouchers = (vouchersRes.data ?? []) as Pick<Voucher, "id" | "code" | "sender_name" | "recipient_name" | "amount" | "payment_status" | "usage_status" | "created_at">[];

  return (
    <PartnerWorkbenchClient
      partner={partner}
      recommendedOrders={orders}
      recommendedVouchers={vouchers}
    />
  );
}
