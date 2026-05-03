import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Order } from "@/types/database";
import WorkbenchClient from "./workbench-client";

export default async function WorkbenchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Aceita tanto o order_id curto (alfanumérico) como o UUID interno,
  // para que links antigos continuem a funcionar.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const column = isUuid ? "id" : "order_id";

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq(column, id)
    .single();

  if (error || !data) notFound();

  return <WorkbenchClient order={data as Order} />;
}
