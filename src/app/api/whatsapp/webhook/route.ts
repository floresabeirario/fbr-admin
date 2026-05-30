import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhone } from "@/lib/format-phone";

// node:crypto não está disponível no Edge runtime — Meta exige HMAC.
export const runtime = "nodejs";
// Webhook nunca pode ser cacheado.
export const dynamic = "force-dynamic";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

type WaMessage = {
  id: string;
  from?: string;
  to?: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  video?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  sticker?: { id: string; mime_type: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  context?: { from: string; id: string };
  reaction?: { message_id: string; emoji: string };
};

// ──────────────────────────────────────────────────────────────
// GET — handshake da Meta
// ──────────────────────────────────────────────────────────────
// A Meta envia: ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
// Temos de ecoar o challenge em texto puro se o token bater.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected) {
    console.error("[wa-webhook] WHATSAPP_VERIFY_TOKEN env var em falta");
    return new Response("server misconfigured", { status: 500 });
  }

  if (mode === "subscribe" && token === expected && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  return new Response("forbidden", { status: 403 });
}

// ──────────────────────────────────────────────────────────────
// POST — eventos
// ──────────────────────────────────────────────────────────────
// Princípio: responder 200 o mais rapidamente possível para evitar
// retransmissões da Meta (limite de 10s). Toda a multimédia é puxada
// num job assíncrono separado — aqui só guardamos a mensagem.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Loggar todos os headers + signature info — temporariamente, enquanto
  // descobrimos como o Dualhook + Meta assinam (App Secret nao e exposto
  // na UI do Dualhook). Remover quando soubermos.
  const allHeaders = Object.fromEntries(request.headers.entries());
  const sigMeta = request.headers.get("x-hub-signature-256");
  const sigDualhook = request.headers.get("x-dualhook-signature");
  console.log("[wa-webhook] POST received", {
    bodyLength: rawBody.length,
    bodyPreview: rawBody.slice(0, 300),
    sigMeta,
    sigDualhook,
    headerKeys: Object.keys(allHeaders),
    allHeaders,
  });

  const appSecret = process.env.META_APP_SECRET;
  const debugAccept = process.env.WHATSAPP_DEBUG_ACCEPT_UNSIGNED === "1";

  // Politica de autorizacao:
  //   1. Se vier X-Hub-Signature-256 e tivermos META_APP_SECRET -> valida HMAC
  //   2. Senao, se vier X-Dualhook-Signature e tivermos DUALHOOK_SIGNING_SECRET -> valida HMAC
  //   3. Senao, se WHATSAPP_DEBUG_ACCEPT_UNSIGNED=1 -> aceita (so durante descoberta)
  //   4. Senao -> rejeita 401
  let authorized = false;
  let authReason = "rejected";

  if (sigMeta && appSecret) {
    if (verifyHmac(rawBody, sigMeta, appSecret)) {
      authorized = true;
      authReason = "meta_hmac";
    } else {
      authReason = "meta_hmac_invalid";
    }
  }

  if (!authorized && sigDualhook) {
    const dualhookSecret = process.env.DUALHOOK_SIGNING_SECRET;
    if (dualhookSecret && verifyHmac(rawBody, sigDualhook, dualhookSecret)) {
      authorized = true;
      authReason = "dualhook_hmac";
    } else if (dualhookSecret) {
      authReason = "dualhook_hmac_invalid";
    }
  }

  if (!authorized && debugAccept) {
    authorized = true;
    authReason = "debug_unsigned_accept";
  }

  console.log("[wa-webhook] auth decision", { authorized, authReason });

  if (!authorized) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[wa-webhook] JSON inválido");
    return new Response("ok", { status: 200 });
  }

  try {
    await processWebhookPayload(payload);
  } catch (err) {
    // Loggar mas devolver 200 — meta_payload guarda o raw para recuperar.
    console.error("[wa-webhook] erro no processamento", err);
  }

  return new Response("ok", { status: 200 });
}

// ──────────────────────────────────────────────────────────────
// HMAC
// ──────────────────────────────────────────────────────────────
function verifyHmac(body: string, signatureHeader: string, secret: string): boolean {
  if (!signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice("sha256=".length);
  const computed = createHmac("sha256", secret).update(body).digest("hex");

  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(provided, "hex");
    b = Buffer.from(computed, "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

// ──────────────────────────────────────────────────────────────
// Parsing + inserção
// ──────────────────────────────────────────────────────────────
async function processWebhookPayload(payload: unknown): Promise<void> {
  if (
    !payload ||
    typeof payload !== "object" ||
    (payload as { object?: string }).object !== "whatsapp_business_account"
  ) {
    return;
  }

  const entries = Array.isArray((payload as { entry?: unknown[] }).entry)
    ? ((payload as { entry: unknown[] }).entry)
    : [];

  const supabase = createAdminClient();

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const changes = Array.isArray((entry as { changes?: unknown[] }).changes)
      ? ((entry as { changes: unknown[] }).changes)
      : [];

    for (const change of changes) {
      if (!change || typeof change !== "object") continue;
      const field = (change as { field?: string }).field;
      const value = (change as { value?: Record<string, unknown> }).value ?? {};

      let direction: "received" | "sent_echo";
      let messages: WaMessage[];

      if (field === "messages") {
        direction = "received";
        messages = (Array.isArray(value.messages) ? value.messages : []) as WaMessage[];
      } else if (field === "smb_message_echoes") {
        direction = "sent_echo";
        // A doc da Meta usa `message_echoes`; alguns ambientes devolvem
        // `messages`. Tolerar ambos.
        const echoArr = (Array.isArray(value.message_echoes)
          ? value.message_echoes
          : Array.isArray(value.messages)
            ? value.messages
            : []) as WaMessage[];
        messages = echoArr;
      } else {
        // 'statuses' (delivery/read) e outros — ignorar para v1.
        continue;
      }

      const contacts = (Array.isArray(value.contacts) ? value.contacts : []) as Array<{
        wa_id?: string;
        profile?: { name?: string };
      }>;
      const contactName = contacts[0]?.profile?.name ?? null;

      for (const msg of messages) {
        try {
          await insertMessage(supabase, msg, direction, contactName);
        } catch (err) {
          console.error("[wa-webhook] erro a inserir mensagem", {
            wamid: msg?.id,
            err: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }
}

async function insertMessage(
  supabase: SupabaseAdmin,
  msg: WaMessage,
  direction: "received" | "sent_echo",
  contactName: string | null,
): Promise<void> {
  if (!msg?.id) return;

  // O telefone da pessoa do outro lado (cliente):
  //   recebida  → msg.from = cliente
  //   eco envio → msg.to   = cliente
  const clientPhoneRaw = direction === "received" ? msg.from : msg.to;
  if (!clientPhoneRaw) return;

  const phoneDigits = clientPhoneRaw.replace(/\D/g, "");
  if (!phoneDigits) return;
  const phoneE164 = `+${phoneDigits}`;
  const displayPhone = formatPhone(phoneDigits);

  const conversationId = await ensureConversation(
    supabase,
    phoneE164,
    displayPhone,
    contactName,
  );

  const content = parseContent(msg);

  // wamid UNIQUE garante idempotência: se a Meta retransmitir, o INSERT
  // falha com 23505 e ignoramos silenciosamente.
  const tsNum = Number(msg.timestamp);
  const receivedAt = Number.isFinite(tsNum) && tsNum > 0
    ? new Date(tsNum * 1000).toISOString()
    : new Date().toISOString();

  const { error } = await supabase.from("whatsapp_messages").insert({
    conversation_id: conversationId,
    wamid: msg.id,
    direction,
    content_type: content.content_type,
    text: content.text,
    media_id: content.media_id,
    media_mime: content.media_mime,
    media_pending: !!content.media_id,
    reply_to_wamid: msg.context?.id ?? null,
    received_at: receivedAt,
    meta_payload: msg as unknown as Record<string, unknown>,
  });

  if (error) {
    if (error.code === "23505") return; // duplicate — already processed
    throw error;
  }
}

async function ensureConversation(
  supabase: SupabaseAdmin,
  phoneE164: string,
  displayPhone: string,
  contactName: string | null,
): Promise<string> {
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("id, contact_name")
    .eq("phone_e164", phoneE164)
    .maybeSingle();

  if (existing) {
    if (contactName && !existing.contact_name) {
      await supabase
        .from("whatsapp_conversations")
        .update({ contact_name: contactName })
        .eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("whatsapp_conversations")
    .insert({
      phone_e164: phoneE164,
      display_phone: displayPhone,
      contact_name: contactName,
    })
    .select("id")
    .single();

  if (error) {
    // Race com outro evento simultâneo do mesmo número — relê.
    if (error.code === "23505") {
      const { data: again } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("phone_e164", phoneE164)
        .single();
      if (again) return again.id;
    }
    throw error;
  }
  return created.id;
}

function parseContent(msg: WaMessage): {
  content_type: string;
  text: string | null;
  media_id: string | null;
  media_mime: string | null;
} {
  switch (msg.type) {
    case "text":
      return {
        content_type: "text",
        text: msg.text?.body ?? null,
        media_id: null,
        media_mime: null,
      };
    case "image":
      return {
        content_type: "image",
        text: msg.image?.caption ?? null,
        media_id: msg.image?.id ?? null,
        media_mime: msg.image?.mime_type ?? null,
      };
    case "video":
      return {
        content_type: "video",
        text: msg.video?.caption ?? null,
        media_id: msg.video?.id ?? null,
        media_mime: msg.video?.mime_type ?? null,
      };
    case "audio":
      return {
        content_type: "audio",
        text: null,
        media_id: msg.audio?.id ?? null,
        media_mime: msg.audio?.mime_type ?? null,
      };
    case "document":
      return {
        content_type: "document",
        text: msg.document?.caption ?? msg.document?.filename ?? null,
        media_id: msg.document?.id ?? null,
        media_mime: msg.document?.mime_type ?? null,
      };
    case "sticker":
      return {
        content_type: "sticker",
        text: null,
        media_id: msg.sticker?.id ?? null,
        media_mime: msg.sticker?.mime_type ?? null,
      };
    case "location": {
      const loc = msg.location;
      const text = loc
        ? `${loc.name ? loc.name + " — " : ""}${loc.latitude},${loc.longitude}${
            loc.address ? " (" + loc.address + ")" : ""
          }`
        : null;
      return { content_type: "location", text, media_id: null, media_mime: null };
    }
    case "reaction":
      return {
        content_type: "reaction",
        text: msg.reaction?.emoji ?? null,
        media_id: null,
        media_mime: null,
      };
    default:
      return {
        content_type: "unsupported",
        text: null,
        media_id: null,
        media_mime: null,
      };
  }
}
