import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { notFound } from "next/navigation";
import type { Order } from "@/types/database";
import type { Partner } from "@/types/partner";
import { loadIntegration } from "@/lib/google/oauth";
import { computeEventHtmlLink } from "@/lib/google/calendar";
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

  let order = orderRes.data as Order;

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
    />
  );
}
