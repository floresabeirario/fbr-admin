import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToAdmins } from "@/lib/push/send";

// Chamado pelo site (fbr-website) logo após criar um vale-presente no
// formulário, para notificar os admins no telemóvel. Mesmo padrão do
// notify-order: sem sessão, autentica-se com INTERNAL_NOTIFY_SECRET.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.INTERNAL_NOTIFY_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (auth.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { code?: string; sender_name?: string; value?: number | string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const sender = (body.sender_name || "").toString().trim() || "Remetente";
  const value = (body.value ?? "").toString().trim();
  const code = (body.code || "").toString().trim();

  try {
    const supabase = createAdminClient();
    await sendPushToAdmins(supabase, {
      title: "🎁 Novo vale-presente",
      body: value ? `${sender} · ${value}€` : sender,
      url: code ? `/vale-presente/${code}` : "/vale-presente",
      tag: code ? `voucher-${code}` : "voucher-new",
    });
  } catch (err) {
    console.error("[notify-voucher] falha ao enviar push", err);
  }

  return NextResponse.json({ ok: true });
}
