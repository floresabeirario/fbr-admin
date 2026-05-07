import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { groupVouchers } from "@/lib/supabase/vouchers";
import type { Voucher } from "@/types/voucher";
import ValePresenteClient from "./vale-presente-client";

export default async function ValePresentePage() {
  const supabase = await createClient();
  const role = await getCurrentRole();

  const { data } = await supabase
    .from("vouchers")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const vouchers: Voucher[] = (data ?? []) as Voucher[];
  const grouped = groupVouchers(vouchers);

  return (
    <ValePresenteClient
      initialVouchers={vouchers}
      initialGrouped={grouped}
      canEdit={role === "admin"}
    />
  );
}
