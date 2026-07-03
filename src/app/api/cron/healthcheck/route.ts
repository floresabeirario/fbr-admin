import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHealthchecks, type HealthCheck } from "@/lib/healthchecks";
import {
  HEALTHCHECK_STATUS_KEY,
  summariseHealthchecks,
  type HealthcheckSummary,
} from "@/lib/healthcheck-cache";
import { computeDailyPushItems } from "@/lib/push/daily";
import { claimDedupKey, sendPushToAdmins } from "@/lib/push/send";
import type { Order } from "@/types/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vercel Cron envia automaticamente `Authorization: Bearer <CRON_SECRET>` em
// produção. Em development, o secret é opcional (deixa correr o endpoint
// manualmente para testar). Em produção sem CRON_SECRET, o endpoint rejeita.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  if (!secret) return !isProd;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  let checks: HealthCheck[];
  try {
    checks = await runHealthchecks(supabase);
  } catch (err) {
    return NextResponse.json(
      { error: "Falha a correr healthchecks", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const summary = summariseHealthchecks(checks);

  // Estado anterior — para só notificar quando PASSA a vermelho (não repetir
  // o aviso todos os dias enquanto continua vermelho).
  let prevErrors = 0;
  try {
    const { data: prevRow } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", HEALTHCHECK_STATUS_KEY)
      .maybeSingle();
    if (prevRow?.value) prevErrors = (JSON.parse(prevRow.value).errors as number) ?? 0;
  } catch {
    // sem estado anterior legível — assume 0 (pode gerar 1 aviso extra)
  }

  // Retenção dos erros JS (mig 086): apaga registos com >30 dias.
  // Best-effort — se a tabela ainda não existir, o check próprio avisa.
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("client_errors").delete().lt("at", thirtyDaysAgo);
  } catch {
    // silêncio — nunca falhar o healthcheck por causa da limpeza
  }

  // Retenção do dedup de push (mig 088): chaves com >60 dias já não servem.
  try {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("push_dedup").delete().lt("sent_at", sixtyDaysAgo);
  } catch {
    // silêncio
  }

  // Notificações push diárias (recolha/flores amanhã, congelador 5 dias) +
  // aviso de healthcheck a vermelho. Best-effort e depois de tudo o resto —
  // o healthcheck nunca falha por causa de um push.
  try {
    await runDailyPushNotifications(supabase, summary, prevErrors);
  } catch (err) {
    console.error("[cron/healthcheck] falha nas notificações push", err);
  }

  const { error: upsertError } = await supabase
    .from("system_settings")
    .upsert({ key: HEALTHCHECK_STATUS_KEY, value: JSON.stringify(summary) });

  return NextResponse.json({
    ...summary,
    persisted: !upsertError,
    persist_error: upsertError?.message,
  });
}

// Notificações push diárias aos admins. Corre uma vez por dia (cron 7h).
async function runDailyPushNotifications(
  supabase: SupabaseClient,
  summary: HealthcheckSummary,
  prevErrors: number,
): Promise<void> {
  const now = new Date();

  // ── Recolha / flores amanhã + congelador 5 dias ──────────────
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_id, client_name, deleted_at, status, flower_delivery_method, pickup_date, pickup_address, event_date, event_location, hand_delivery_date, freezer_in_at, freezer_out_at",
    )
    .is("deleted_at", null);

  const items = computeDailyPushItems((orders ?? []) as unknown as Order[], now);
  for (const item of items) {
    // Deduplica primeiro: se já enviámos este aviso, saltamos.
    const isNew = await claimDedupKey(supabase, item.dedupKey);
    if (isNew) await sendPushToAdmins(supabase, item.payload);
  }

  // ── Healthcheck a vermelho (só na transição para vermelho) ────
  if (summary.errors > 0 && prevErrors === 0) {
    const labels = summary.problems
      .filter((p) => p.status === "error")
      .map((p) => p.label);
    const body =
      labels.length > 0
        ? labels.slice(0, 3).join(" · ")
        : `${summary.errors} problema(s) a precisar de atenção`;
    await sendPushToAdmins(supabase, {
      title: "🚑 Healthcheck a vermelho",
      body,
      url: "/healthchecks",
      tag: "healthcheck-red",
    });
  }
}
