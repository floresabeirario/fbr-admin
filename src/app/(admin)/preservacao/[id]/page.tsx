import { createClient } from "@/lib/supabase/server";
import { getCurrentRole, getCurrentEmail } from "@/lib/auth/server";
import { notFound } from "next/navigation";
import type { Order } from "@/types/database";
import type { Partner } from "@/types/partner";
import type { Task, TaskTemplate } from "@/types/tasks";
import { loadIntegration } from "@/lib/google/oauth";
import { computeEventHtmlLink } from "@/lib/google/calendar";
import { markOrderSeenAction } from "../actions";
import WorkbenchClient from "./workbench-client";

export default async function WorkbenchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const role = await getCurrentRole();
  const currentEmail = (await getCurrentEmail()) ?? "";

  // Aceita tanto o order_id curto (alfanumérico) como o UUID interno,
  // para que links antigos continuem a funcionar.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const column = isUuid ? "id" : "order_id";

  const [orderRes, partnersRes, templatesRes] = await Promise.all([
    supabase.from("orders").select("*").eq(column, id).single(),
    supabase
      .from("partners")
      .select("id, name, category, status")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("task_templates")
      .select("*")
      .is("deleted_at", null)
      .in("scope", ["order", "both"])
      .order("position", { ascending: true }),
  ]);

  if (orderRes.error || !orderRes.data) notFound();

  const partnerOptions = (partnersRes.data ?? []) as Pick<Partner, "id" | "name" | "category" | "status">[];
  const taskTemplates = (templatesRes.data ?? []) as TaskTemplate[];

  let order = orderRes.data as Order;

  // Tarefas activas desta encomenda (done + done_at + soft delete filtrados).
  // Carregadas com o ID interno após o lookup acima (`order.id` é UUID).
  const { data: tasksData } = await supabase
    .from("tasks")
    .select("*")
    .is("deleted_at", null)
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });
  const orderTasks = (tasksData ?? []) as Task[];

  // Se a encomenda tem código de vale-presente associado, verifica se existe um
  // vale activo com esse código — workbench mostra link directo para o vale.
  let linkedVoucherCode: string | null = null;
  if (order.gift_voucher_code) {
    const { data: voucherRow } = await supabase
      .from("vouchers")
      .select("code")
      .eq("code", order.gift_voucher_code.toUpperCase())
      .is("deleted_at", null)
      .maybeSingle();
    linkedVoucherCode = voucherRow?.code ?? null;
  }

  // Marcar como vista pelo utilizador actual (acrescenta email ao seen_by[]).
  // Fire-and-forget — não bloqueia o render se a RPC falhar. Idempotente
  // a partir da segunda visita (a RPC verifica NOT email = ANY(seen_by)).
  void markOrderSeenAction(order.id);

  // Backfill do htmlLink para encomendas com evento Calendar criado
  // antes da migração 037. Constrói o URL a partir do calendar_id da
  // integração. Não chama a API Google — só dá lookup à integração.
  if (order.calendar_event_id && !order.calendar_event_html_link) {
    try {
      const integration = await loadIntegration();
      if (integration?.calendar_id) {
        order = {
          ...order,
          calendar_event_html_link: computeEventHtmlLink(
            order.calendar_event_id,
            integration.calendar_id,
          ),
        };
      }
    } catch {
      // Sem integração ou erro — botão fica sem link (popover Re-sincronizar resolve).
    }
  }

  return (
    <WorkbenchClient
      order={order}
      canEdit={role === "admin"}
      partners={partnerOptions}
      taskTemplates={taskTemplates}
      orderTasks={orderTasks}
      currentEmail={currentEmail}
      linkedVoucherCode={linkedVoucherCode}
    />
  );
}
