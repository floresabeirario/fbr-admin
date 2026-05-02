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

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  return <WorkbenchClient order={data as Order} />;
}
