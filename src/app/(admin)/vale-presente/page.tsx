import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { groupVouchers } from "@/lib/supabase/vouchers";
import type { Voucher } from "@/types/voucher";
import ValePresenteClient from "./vale-presente-client";
import { voucherMinAmount } from "@/lib/pricing";
import type { PricingItem } from "@/types/pricing";

export default async function ValePresentePage() {
  const supabase = await createClient();
  const role = await getCurrentRole();

  const [activeRes, archivedRes, pricingRes] = await Promise.all([
    supabase
      .from("vouchers")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("vouchers")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase.from("pricing_items").select("*").is("deleted_at", null),
  ]);

  const vouchers: Voucher[] = (activeRes.data ?? []) as Voucher[];
  const archivedVouchers: Voucher[] = (archivedRes.data ?? []) as Voucher[];
  const grouped = groupVouchers(vouchers);
  // O mínimo do vale segue o preço do quadro mais pequeno (Finanças), em
  // vez de estar preso a 300€: sobe sozinho quando esse preço subir.
  const minAmount = voucherMinAmount((pricingRes.data ?? []) as PricingItem[]);

  return (
    <ValePresenteClient
      initialVouchers={vouchers}
      initialGrouped={grouped}
      archivedVouchers={archivedVouchers}
      canEdit={role === "admin"}
      minAmount={minAmount}
    />
  );
}
