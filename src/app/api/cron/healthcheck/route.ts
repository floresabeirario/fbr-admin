import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHealthchecks, type HealthCheck } from "@/lib/healthchecks";

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

// Envia email via Resend HTTP API directamente (sem npm dependency).
// No-op gracioso se `RESEND_API_KEY` não estiver configurada.
async function sendAlertEmail(problems: HealthCheck[]) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY não configurada" };

  const from = process.env.RESEND_FROM_EMAIL ?? "FBR Healthcheck <healthcheck@floresabeirario.pt>";
  const to = process.env.RESEND_ALERT_TO ?? "info@floresabeirario.pt";

  const errors = problems.filter((p) => p.status === "error");
  const warnings = problems.filter((p) => p.status === "warning");

  const subject =
    errors.length > 0
      ? `🚨 FBR Admin — ${errors.length} erro(s) no healthcheck diário`
      : `⚠️ FBR Admin — ${warnings.length} aviso(s) no healthcheck diário`;

  const rows = problems
    .map(
      (p) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;color:${
            p.status === "error" ? "#b91c1c" : "#a16207"
          };font-weight:600;text-transform:uppercase;">${p.status}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">
            <div style="font-weight:600;color:#0c0a09;">${escapeHtml(p.label)}</div>
            <div style="font-size:13px;color:#44403c;margin-top:2px;">${escapeHtml(p.details)}</div>
            ${p.hint ? `<div style="font-size:12px;color:#78716c;margin-top:4px;font-style:italic;">💡 ${escapeHtml(p.hint)}</div>` : ""}
          </td>
        </tr>`,
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#faf3e8;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7d8c2;">
    <div style="background:${errors.length > 0 ? "#fef2f2" : "#fffbeb"};padding:16px 20px;border-bottom:1px solid #e7d8c2;">
      <h1 style="margin:0;font-size:18px;color:#0c0a09;">${subject}</h1>
      <p style="margin:6px 0 0;font-size:13px;color:#44403c;">Executado em ${new Date().toLocaleString("pt-PT")}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">${rows}</table>
    <div style="padding:16px 20px;background:#fafaf9;font-size:12px;color:#78716c;">
      Vê o detalhe completo em <a href="https://admin.floresabeirario.pt/healthchecks" style="color:#0c0a09;">admin.floresabeirario.pt/healthchecks</a>.
    </div>
  </div>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    return { sent: false, reason: `Resend ${res.status}: ${body.slice(0, 200)}` };
  }
  return { sent: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let checks: HealthCheck[];
  try {
    const supabase = createAdminClient();
    checks = await runHealthchecks(supabase);
  } catch (err) {
    return NextResponse.json(
      { error: "Falha a correr healthchecks", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  const problems = checks.filter((c) => c.status === "error" || c.status === "warning");
  const errors = problems.filter((p) => p.status === "error").length;
  const warnings = problems.filter((p) => p.status === "warning").length;

  let emailResult: { sent: boolean; reason?: string } = { sent: false, reason: "sem problemas" };
  if (problems.length > 0) {
    emailResult = await sendAlertEmail(problems);
  }

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    total_checks: checks.length,
    errors,
    warnings,
    email: emailResult,
  });
}
