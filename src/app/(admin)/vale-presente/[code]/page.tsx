import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { notFound } from "next/navigation";
import type { Voucher } from "@/types/voucher";
import VoucherWorkbenchClient from "./workbench-client";

export default async function VoucherWorkbenchPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const role = await getCurrentRole();

  // Aceita o código curto (6 dígitos) ou o UUID interno.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
  const column = isUuid ? "id" : "code";

  const { data, error } = await supabase
    .from("vouchers")
    .select("*")
    .eq(column, code.toUpperCase())
    .single();

  if (error || !data) notFound();

  return (
    <VoucherWorkbenchClient voucher={data as Voucher} canEdit={role === "admin"} />
  );
}
