import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHealthchecks, type HealthCheck } from "@/lib/healthchecks";
import { HEALTHCHECK_STATUS_KEY, summariseHealthchecks } from "@/lib/healthcheck-cache";

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

  // Retenção dos erros JS (mig 086): apaga registos com >30 dias.
  // Best-effort — se a tabela ainda não existir, o check próprio avisa.
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("client_errors").delete().lt("at", thirtyDaysAgo);
  } catch {
    // silêncio — nunca falhar o healthcheck por causa da limpeza
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
