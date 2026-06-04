import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/types/partner";
import type { PublicFigure } from "@/types/public-figure";
import type { CommissionItem } from "@/lib/commissions";
import { COMMISSION_PENDING_STATUSES } from "@/lib/commissions";
import ParceriasTabs from "./parcerias-tabs";

export default async function ParceriasPage() {
  const supabase = await createClient();

  const pendingStatuses = [...COMMISSION_PENDING_STATUSES];

  const [
    partnersRes,
    ordersRes,
    vouchersRes,
    figuresRes,
    commOrdersRes,
    commVouchersRes,
  ] = await Promise.all([
    supabase
      .from("partners")
      .select("*")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("orders")
      .select("partner_id")
      .is("deleted_at", null)
      .not("partner_id", "is", null),
    supabase
      .from("vouchers")
      .select("partner_id")
      .is("deleted_at", null)
      .not("partner_id", "is", null),
    supabase
      .from("public_figures")
      .select("*")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    // Comissões por saldar — encomendas
    supabase
      .from("orders")
      .select(
        "id, order_id, client_name, partner_id, partner_commission, partner_commission_status, updated_at",
      )
      .is("deleted_at", null)
      .not("partner_id", "is", null)
      .in("partner_commission_status", pendingStatuses),
    // Comissões por saldar — vales
    supabase
      .from("vouchers")
      .select(
        "id, code, sender_name, recipient_name, partner_id, partner_commission, partner_commission_status, updated_at",
      )
      .is("deleted_at", null)
      .not("partner_id", "is", null)
      .in("partner_commission_status", pendingStatuses),
  ]);

  const partners: Partner[] = (partnersRes.data ?? []) as Partner[];
  const figures: PublicFigure[] = (figuresRes.data ?? []) as PublicFigure[];

  // Conta encomendas e vales por partner_id
  const ordersCount: Record<string, number> = {};
  for (const row of ordersRes.data ?? []) {
    const id = (row as { partner_id: string | null }).partner_id;
    if (id) ordersCount[id] = (ordersCount[id] ?? 0) + 1;
  }
  const vouchersCount: Record<string, number> = {};
  for (const row of vouchersRes.data ?? []) {
    const id = (row as { partner_id: string | null }).partner_id;
    if (id) vouchersCount[id] = (vouchersCount[id] ?? 0) + 1;
  }

  // Comissões por saldar — consolida encomendas + vales numa lista única
  const commissions: CommissionItem[] = [];
  for (const row of (commOrdersRes.data ?? []) as Array<{
    id: string;
    order_id: string | null;
    client_name: string;
    partner_id: string | null;
    partner_commission: number | null;
    partner_commission_status: CommissionItem["status"];
    updated_at: string;
  }>) {
    if (!row.partner_id) continue;
    commissions.push({
      kind: "order",
      rowId: row.id,
      code: row.order_id ?? row.id,
      partnerId: row.partner_id,
      label: row.client_name,
      amount: row.partner_commission,
      status: row.partner_commission_status,
      updatedAt: row.updated_at,
    });
  }
  for (const row of (commVouchersRes.data ?? []) as Array<{
    id: string;
    code: string;
    sender_name: string;
    recipient_name: string | null;
    partner_id: string | null;
    partner_commission: number | null;
    partner_commission_status: CommissionItem["status"];
    updated_at: string;
  }>) {
    if (!row.partner_id) continue;
    commissions.push({
      kind: "voucher",
      rowId: row.id,
      code: row.code,
      partnerId: row.partner_id,
      label: row.recipient_name
        ? `${row.sender_name} → ${row.recipient_name}`
        : row.sender_name,
      amount: row.partner_commission,
      status: row.partner_commission_status,
      updatedAt: row.updated_at,
    });
  }

  return (
    <ParceriasTabs
      initialPartners={partners}
      ordersCount={ordersCount}
      vouchersCount={vouchersCount}
      initialFigures={figures}
      commissions={commissions}
    />
  );
}
