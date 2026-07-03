import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Exportar todas as tabelas + upload à Drive pode passar dos 10s default.
export const maxDuration = 60;

// Mesmo padrão do /api/cron/healthcheck: Vercel Cron envia
// `Authorization: Bearer <CRON_SECRET>` automaticamente em produção.
// Em development o secret é opcional (para testar à mão).
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
  const status = await runBackup(supabase);

  return NextResponse.json(status, { status: status.ok ? 200 : 500 });
}
