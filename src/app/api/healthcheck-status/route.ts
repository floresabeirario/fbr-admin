import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { runHealthchecks } from "@/lib/healthchecks";
import {
  HEALTHCHECK_STATUS_KEY,
  summariseHealthchecks,
  type HealthcheckSummary,
} from "@/lib/healthcheck-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Se a cache da bolinha tiver mais do que isto, voltamos a correr os
// healthchecks aqui mesmo (auto-cura). Assim a bolinha mantém-se fresca
// com o uso normal da plataforma, sem depender do cron diário nem de
// alguém abrir a aba Healthchecks.
const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // 6 horas

function isStale(summary: HealthcheckSummary | null): boolean {
  if (!summary?.ran_at) return true;
  const ranAt = new Date(summary.ran_at).getTime();
  if (Number.isNaN(ranAt)) return true;
  return Date.now() - ranAt > STALE_AFTER_MS;
}

export async function GET() {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("value, updated_at")
    .eq("key", HEALTHCHECK_STATUS_KEY)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let summary: HealthcheckSummary | null = null;
  if (data) {
    try {
      summary = JSON.parse(data.value) as HealthcheckSummary;
    } catch {
      summary = null;
    }
  }

  // Cache em falta ou velha → corre os checks agora e regrava. Maria é
  // admin → a RLS de system_settings deixa escrever. Se algo falhar,
  // devolvemos o que tínhamos (não rebenta a bolinha).
  if (isStale(summary)) {
    try {
      const checks = await runHealthchecks(supabase);
      const fresh = summariseHealthchecks(checks);
      await supabase
        .from("system_settings")
        .upsert({ key: HEALTHCHECK_STATUS_KEY, value: JSON.stringify(fresh) });
      summary = fresh;
    } catch {
      // mantém o summary anterior (pode ser null) — melhor que falhar
    }
  }

  return NextResponse.json({ summary });
}
