import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToAdmins } from "@/lib/push/send";

// Chamado pelo site (fbr-website) logo após criar uma pré-reserva no
// formulário, para notificar os admins no telemóvel. Não usa sessão
// (o site não a tem) — autentica-se com um segredo partilhado. Espelha a
// notificação por email (Resend) que o site já envia no mesmo ponto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.INTERNAL_NOTIFY_SECRET;
  if (!secret) return false; // sem segredo configurado, ninguém entra
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

  let body: { order_id?: string; client_name?: string; event_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const name = (body.client_name || "").trim() || "Cliente";
  const eventType = (body.event_type || "").trim();
  const orderId = (body.order_id || "").trim();

  try {
    const supabase = createAdminClient();
    await sendPushToAdmins(supabase, {
      title: "🌸 Nova encomenda",
      body: eventType ? `${name} · ${eventType}` : name,
      url: orderId ? `/preservacao/${orderId}` : "/preservacao",
      tag: orderId ? `order-${orderId}` : "order-new",
    });
  } catch (err) {
    // Best-effort: nunca fazemos o site esperar/falhar por causa do push.
    console.error("[notify-order] falha ao enviar push", err);
  }

  return NextResponse.json({ ok: true });
}
