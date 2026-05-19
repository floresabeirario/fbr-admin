import { createClient } from "@/lib/supabase/server";
import { getCurrentRole, getCurrentEmail } from "@/lib/auth/server";
import { notFound } from "next/navigation";
import type { Voucher } from "@/types/voucher";
import type { Partner } from "@/types/partner";
import type { Task, TaskTemplate } from "@/types/tasks";
import VoucherWorkbenchClient from "./workbench-client";

export default async function VoucherWorkbenchPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const role = await getCurrentRole();
  const currentEmail = (await getCurrentEmail()) ?? "";

  // Aceita o código curto (6 dígitos) ou o UUID interno.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);
  const column = isUuid ? "id" : "code";

  const [voucherRes, partnersRes, templatesRes] = await Promise.all([
    supabase.from("vouchers").select("*").eq(column, code.toUpperCase()).single(),
    supabase
      .from("partners")
      .select("id, name, category, status")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("task_templates")
      .select("*")
      .is("deleted_at", null)
      .in("scope", ["voucher", "both"])
      .order("position", { ascending: true }),
  ]);

  if (voucherRes.error || !voucherRes.data) notFound();

  const partnerOptions = (partnersRes.data ?? []) as Pick<Partner, "id" | "name" | "category" | "status">[];
  const taskTemplates = (templatesRes.data ?? []) as TaskTemplate[];
  const voucher = voucherRes.data as Voucher;

  const { data: tasksData } = await supabase
    .from("tasks")
    .select("*")
    .is("deleted_at", null)
    .eq("voucher_id", voucher.id)
    .order("created_at", { ascending: false });
  const voucherTasks = (tasksData ?? []) as Task[];

  return (
    <VoucherWorkbenchClient
      voucher={voucher}
      canEdit={role === "admin"}
      partners={partnerOptions}
      taskTemplates={taskTemplates}
      voucherTasks={voucherTasks}
      currentEmail={currentEmail}
    />
  );
}
