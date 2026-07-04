import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { runBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Exportar todas as tabelas + upload à Drive pode passar dos 10s default.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const status = await runBackup(supabase);

  return NextResponse.json(status, { status: status.ok ? 200 : 500 });
}
