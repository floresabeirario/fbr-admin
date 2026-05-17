import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { HEALTHCHECK_STATUS_KEY, type HealthcheckSummary } from "@/lib/healthcheck-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  if (!data) {
    return NextResponse.json({ summary: null });
  }

  try {
    const summary = JSON.parse(data.value) as HealthcheckSummary;
    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ summary: null });
  }
}
