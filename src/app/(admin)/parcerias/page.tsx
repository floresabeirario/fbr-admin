import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/types/partner";
import type { PublicFigure } from "@/types/public-figure";
import ParceriasTabs from "./parcerias-tabs";

export default async function ParceriasPage() {
  const supabase = await createClient();

  const [partnersRes, ordersRes, vouchersRes, figuresRes] = await Promise.all([
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

  return (
    <ParceriasTabs
      initialPartners={partners}
      ordersCount={ordersCount}
      vouchersCount={vouchersCount}
      initialFigures={figures}
    />
  );
}
