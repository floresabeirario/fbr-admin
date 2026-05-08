import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { notFound } from "next/navigation";
import type { Order } from "@/types/database";
import type { Partner } from "@/types/partner";
import WorkbenchClient from "./workbench-client";

export default async function WorkbenchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const role = await getCurrentRole();

  // Aceita tanto o order_id curto (alfanumérico) como o UUID interno,
  // para que links antigos continuem a funcionar.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const column = isUuid ? "id" : "order_id";

  const [orderRes, partnersRes] = await Promise.all([
    supabase.from("orders").select("*").eq(column, id).single(),
    supabase
      .from("partners")
      .select("id, name, category, status")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
  ]);

  if (orderRes.error || !orderRes.data) notFound();

  const partnerOptions = (partnersRes.data ?? []) as Pick<Partner, "id" | "name" | "category" | "status">[];

  return (
    <WorkbenchClient
      order={orderRes.data as Order}
      canEdit={role === "admin"}
      partners={partnerOptions}
    />
  );
}
