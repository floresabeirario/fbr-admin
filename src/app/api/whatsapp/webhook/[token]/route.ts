import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhone } from "@/lib/format-phone";
import { fetchPendingMediaBatch } from "@/lib/whatsapp/media-fetch";

// node:crypto nao esta no Edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupabaseAdmin = ReturnType<typeof createAdminClient>;
type RouteContext = { params: Promise<{ token: string }> };

// Serializa erro do Supabase (plain object com code/message/details/hint).
function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { message: err.message, name: err.name, stack: err.stack };
  }
  if (typeof err === "object" && err !== null) {
    return { ...(err as Record<string, unknown>) };
  }
  return { value: String(err) };
}

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
// Validacao do path token
// ──────────────────────────────────────────────────────────────
// Reusa WHATSAPP_VERIFY_TOKEN — ja e secret, ja esta gerado, evita
// uma env var extra. Comparacao em tempo constante para evitar timing
// attacks.
function isValidPathToken(tokenFromPath: string): boolean {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!expected) return false;
  if (tokenFromPath.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(tokenFromPath, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}

// ──────────────────────────────────────────────────────────────
// GET — handshake da Meta
// ──────────────────────────────────────────────────────────────
export async function GET(request: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  if (!isValidPathToken(token)) {
    return new Response("not found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const verifyToken = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && verifyToken === expected && challenge) {
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
// Devolver 200 rapidamente (limite de 10s da Meta). Multimedia e
// puxada em job separado.
export async function POST(request: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  if (!isValidPathToken(token)) {
    // Path token errado: 404 (nao 401) para nao revelar que o endpoint existe.
    return new Response("not found", { status: 404 });
  }

  const rawBody = await request.text();

  // Validacao HMAC opcional (so se META_APP_SECRET estiver definido).
  // Atualmente nao temos esse secret (Dualhook nao expoe; Meta App e
  // multi-tenant deles). Path token suficiente.
  const sigMeta = request.headers.get("x-hub-signature-256");
  const appSecret = process.env.META_APP_SECRET;
  if (sigMeta && appSecret && !verifyHmac(rawBody, sigMeta, appSecret)) {
    console.error("[wa-webhook] HMAC invalido apesar de token correto");
    return new Response("unauthorized", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.error("[wa-webhook] JSON invalido");
    return new Response("ok", { status: 200 });
  }

  let hadMedia = false;
  try {
    hadMedia = await processWebhookPayload(payload);
  } catch (err) {
    // 200 mesmo em erro — meta_payload guarda o raw para recuperar manualmente.
    console.error("[wa-webhook] erro no processamento", serializeError(err));
  }

  // Background: se chegou multimedia, vai buscar logo a seguir a responder
  // 200 a Meta (URLs da Meta expiram em ~5min — nao da para esperar cron).
  if (hadMedia) {
    after(async () => {
      try {
        await fetchPendingMediaBatch();
      } catch (err) {
        console.error("[wa-webhook] erro media fetch", serializeError(err));
      }
    });
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
// Parsing + insercao
// ──────────────────────────────────────────────────────────────
type StatusEvent = {
  id?: string;
  status?: "delivered" | "read" | "failed" | "sent";
  timestamp?: string;
  recipient_id?: string;
};

async function processStatuses(
  supabase: SupabaseAdmin,
  rawStatuses: unknown[],
): Promise<void> {
  for (const raw of rawStatuses) {
    const s = raw as StatusEvent;
    if (!s?.id || !s.status) continue;
    // Apenas mapeamos os 3 estados visiveis na UI; 'sent' = estado inicial,
    // sem necessidade de gravar (default NULL ja serve).
    if (s.status !== "delivered" && s.status !== "read" && s.status !== "failed") continue;

    const tsNum = Number(s.timestamp);
    const at = Number.isFinite(tsNum) && tsNum > 0
      ? new Date(tsNum * 1000).toISOString()
      : new Date().toISOString();

    const update: Record<string, unknown> = { delivery_status: s.status };
    if (s.status === "delivered") update.delivered_at = at;
    if (s.status === "read") update.read_at = at;

    const { error } = await supabase
      .from("whatsapp_messages")
      .update(update)
      .eq("wamid", s.id);
    if (error) {
      console.warn("[wa-webhook] update status falhou", { wamid: s.id, err: error.message });
    }
  }
}

async function processWebhookPayload(payload: unknown): Promise<boolean> {
  if (
    !payload ||
    typeof payload !== "object" ||
    (payload as { object?: string }).object !== "whatsapp_business_account"
  ) {
    return false;
  }
  let hadMedia = false;

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
        // Mesma payload pode tambem trazer statuses (entrega/leitura)
        // de mensagens que enviamos ou ecoamos. Processar aqui.
        if (Array.isArray(value.statuses)) {
          await processStatuses(supabase, value.statuses);
        }
      } else if (field === "smb_message_echoes") {
        direction = "sent_echo";
        const echoArr = (Array.isArray(value.message_echoes)
          ? value.message_echoes
          : Array.isArray(value.messages)
            ? value.messages
            : []) as WaMessage[];
        messages = echoArr;
      } else {
        // Outros campos — ignorar.
        continue;
      }

      const contacts = (Array.isArray(value.contacts) ? value.contacts : []) as Array<{
        wa_id?: string;
        profile?: { name?: string };
      }>;
      const contactName = contacts[0]?.profile?.name ?? null;
      // contacts[0].wa_id = "outra parte" da conversa, sempre presente.
      const clientPhoneFromContacts = contacts[0]?.wa_id ?? null;

      for (const msg of messages) {
        try {
          const inserted = await insertMessage(
            supabase, msg, direction, contactName, clientPhoneFromContacts,
          );
          if (inserted?.hasMedia) hadMedia = true;
        } catch (err) {
          console.error("[wa-webhook] erro a inserir mensagem", {
            wamid: msg?.id,
            direction,
            msgType: msg?.type,
            errInfo: serializeError(err),
          });
        }
      }
    }
  }
  return hadMedia;
}

async function insertMessage(
  supabase: SupabaseAdmin,
  msg: WaMessage,
  direction: "received" | "sent_echo",
  contactName: string | null,
  clientPhoneFromContacts: string | null,
): Promise<{ hasMedia: boolean } | null> {
  if (!msg?.id) return null;

  const clientPhoneRaw =
    clientPhoneFromContacts ?? (direction === "received" ? msg.from : msg.to);
  if (!clientPhoneRaw) return null;

  const phoneDigits = clientPhoneRaw.replace(/\D/g, "");
  if (!phoneDigits) return null;
  const phoneE164 = `+${phoneDigits}`;
  const displayPhone = formatPhone(phoneDigits);

  const conversationId = await ensureConversation(
    supabase,
    phoneE164,
    displayPhone,
    contactName,
  );

  const content = parseContent(msg);

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
    if (error.code === "23505") return null; // duplicate — wamid ja existe (idempotencia)
    throw error;
  }

  // Quando recebemos um eco da Maria (mensagem que ela enviou pelo
  // telemovel), assumimos que ela leu tudo o que estava por ler.
  // Zera unread_count da conversa. Resolve o caso "respondi no telemovel
  // mas a plataforma continuava a mostrar bolinha verde".
  if (direction === "sent_echo") {
    await supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", conversationId)
      .gt("unread_count", 0); // no-op se ja esta 0
  }

  return { hasMedia: !!content.media_id };
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
