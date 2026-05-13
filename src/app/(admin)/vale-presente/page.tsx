import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { groupVouchers } from "@/lib/supabase/vouchers";
import type { Voucher } from "@/types/voucher";
import ValePresenteClient from "./vale-presente-client";

export default async function ValePresentePage() {
  const supabase = await createClient();
  const role = await getCurrentRole();

  const [activeRes, archivedRes] = await Promise.all([
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
  ]);

  const vouchers: Voucher[] = (activeRes.data ?? []) as Voucher[];
  const archivedVouchers: Voucher[] = (archivedRes.data ?? []) as Voucher[];
  const grouped = groupVouchers(vouchers);

  return (
    <ValePresenteClient
      initialVouchers={vouchers}
      initialGrouped={grouped}
      archivedVouchers={archivedVouchers}
      canEdit={role === "admin"}
    />
  );
}
