import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhone } from "@/lib/format-phone";
import { fetchPendingMediaBatch } from "@/lib/whatsapp/media-fetch";
import { sendPushToEmails } from "@/lib/push/send";
import { TEAM } from "@/lib/auth/roles";

// Notificações push de WhatsApp vão SÓ para o António (decisão da Maria).
// Derivado do TEAM (fonte única) — nunca hardcodar o email aqui.
const ANTONIO_EMAIL = TEAM.find((m) => m.name === "António")?.email ?? null;

// Pré-visualização curta da mensagem para o corpo da notificação.
function whatsappPreview(contentType: string, text: string | null): string {
  if (text && text.trim()) return text.trim();
  switch (contentType) {
    case "image": return "📷 Imagem";
    case "video": return "🎥 Vídeo";
    case "audio": return "🎧 Mensagem de voz";
    case "document": return "📄 Documento";
    case "sticker": return "Sticker";
    case "location": return "📍 Localização";
    default: return "Nova mensagem";
  }
}

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
  // Mensagem editada no WhatsApp: o texto novo vem embrulhado aqui, e a
  // mensagem chega com um wamid PRÓPRIO (não substitui a original).
  edit?: { message?: { text?: { body?: string } } };
  // "Apagar para todos": aponta para a mensagem que deixou de valer.
  revoke?: { original_message_id?: string };
  // Cartões de contacto partilhados.
  contacts?: Array<{
    name?: { formatted_name?: string; first_name?: string; last_name?: string };
    phones?: Array<{ phone?: string }>;
  }>;
};

type ParsedContent = {
  content_type: string;
  text: string | null;
  media_id: string | null;
  media_mime: string | null;
  is_edit: boolean;
  revoke_target_wamid: string | null;
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

  let result: ProcessResult = { hadMedia: false, retryable: 0 };
  try {
    result = await processWebhookPayload(payload);
  } catch (err) {
    console.error("[wa-webhook] erro no processamento", serializeError(err));
    // Falha global (ex.: Supabase em baixo): pedir retransmissão de tudo.
    result = { hadMedia: false, retryable: 1 };
  }

  // Background: se chegou multimedia, vai buscar logo a seguir a responder
  // 200 a Meta (URLs da Meta expiram em ~5min — nao da para esperar cron).
  if (result.hadMedia) {
    after(async () => {
      try {
        await fetchPendingMediaBatch();
      } catch (err) {
        console.error("[wa-webhook] erro media fetch", serializeError(err));
      }
    });
  }

  // Até à sessão 166 respondia-se SEMPRE 200, mesmo quando a gravação
  // falhava. A Meta lê 200 como "entregue" e nunca retransmite, portanto
  // uma falha de um segundo com o Supabase apagava a mensagem para
  // sempre — foi assim que se perderam mensagens em ambos os sentidos.
  //
  // Agora devolve-se 500 e a Meta retransmite durante 7 dias. É seguro
  // porque o wamid é UNIQUE: as retransmissões do que já entrou são
  // ignoradas em silêncio (23505).
  //
  // Ressalva importante: se uma mensagem falhar SEMPRE (payload que a
  // nossa CHECK constraint recusa, por exemplo), retransmitir para todo
  // o sempre faria a Meta desactivar a subscrição e perdíamos tudo. Por
  // isso `retryable` só conta falhas com menos de MAX_RETRY tentativas
  // registadas; passado esse ponto damo-la por perdida, respondemos 200
  // e fica registada em whatsapp_webhook_failures para tratar à mão.
  if (result.retryable > 0) {
    return new Response("retry", { status: 500 });
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

// Ao fim de 3 retransmissões falhadas damos a mensagem por perdida e
// respondemos 200, para a Meta não desactivar a subscrição por causa de
// uma mensagem que nunca vai entrar. Fica registada para tratar à mão.
const MAX_RETRY = 3;

type ProcessResult = { hadMedia: boolean; retryable: number };

// Regista (ou incrementa) uma falha e diz se ainda vale a pena pedir
// retransmissão à Meta. Nunca deixa rebentar: se o próprio registo
// falhar, assumimos que vale a pena tentar outra vez.
async function recordFailure(
  supabase: SupabaseAdmin,
  info: {
    wamid: string | null;
    direction: string;
    msgType: string | null;
    phoneE164: string | null;
    stage: string;
    err: unknown;
  },
): Promise<boolean> {
  const e = info.err as { code?: string; message?: string };
  const errorCode = e?.code ?? null;
  const errorMessage =
    (info.err instanceof Error ? info.err.message : e?.message) ?? String(info.err);

  try {
    let attempts = 1;
    if (info.wamid) {
      const { data: existing } = await supabase
        .from("whatsapp_webhook_failures")
        .select("attempts")
        .eq("wamid", info.wamid)
        .maybeSingle();
      if (existing) attempts = (existing.attempts as number) + 1;
    }

    await supabase.from("whatsapp_webhook_failures").upsert(
      {
        wamid: info.wamid,
        direction: info.direction,
        msg_type: info.msgType,
        phone_e164: info.phoneE164,
        stage: info.stage,
        error_code: errorCode,
        error_message: errorMessage?.slice(0, 500) ?? null,
        attempts,
        resolved: false,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "wamid" },
    );

    return attempts < MAX_RETRY;
  } catch (logErr) {
    console.error("[wa-webhook] nao consegui registar a falha", serializeError(logErr));
    return true;
  }
}

// Escolhe o número da "outra parte" para ESTA mensagem.
//
// Antes usava-se sempre contacts[0].wa_id para todas as mensagens da
// remessa. Quando a Meta agrupa mensagens de pessoas diferentes no mesmo
// evento, as da segunda pessoa iam parar à conversa da primeira.
//
// Não se pode simplesmente trocar por msg.from: a Meta documenta que em
// alguns países (Brasil, Argentina) o `from` e o `wa_id` diferem, e o
// wa_id é o canónico — trocar criaria conversas duplicadas. Por isso:
// com um contacto só mantém-se o comportamento antigo, e só quando há
// vários é que se procura o que corresponde a esta mensagem.
function resolveCounterparty(
  msg: WaMessage,
  direction: "received" | "sent_echo",
  contacts: Array<{ wa_id?: string; profile?: { name?: string } }>,
): { phoneRaw: string | null; contactName: string | null } {
  const ownSide = direction === "received" ? msg.from : msg.to;

  if (contacts.length <= 1) {
    return {
      phoneRaw: contacts[0]?.wa_id ?? ownSide ?? null,
      contactName: contacts[0]?.profile?.name ?? null,
    };
  }

  const digits = (s: string | undefined) => (s ?? "").replace(/\D/g, "");
  const match = contacts.find((c) => digits(c.wa_id) === digits(ownSide));
  if (match) {
    return { phoneRaw: match.wa_id ?? ownSide ?? null, contactName: match.profile?.name ?? null };
  }
  // Vários contactos e nenhum bate certo: o `from`/`to` desta mensagem é
  // mais fiável do que assumir o primeiro da lista.
  return { phoneRaw: ownSide ?? null, contactName: null };
}

async function processWebhookPayload(payload: unknown): Promise<ProcessResult> {
  if (
    !payload ||
    typeof payload !== "object" ||
    (payload as { object?: string }).object !== "whatsapp_business_account"
  ) {
    return { hadMedia: false, retryable: 0 };
  }
  let hadMedia = false;
  let retryable = 0;

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

      for (const msg of messages) {
        const { phoneRaw, contactName } = resolveCounterparty(msg, direction, contacts);
        try {
          const inserted = await insertMessage(
            supabase, msg, direction, contactName, phoneRaw,
          );
          if (inserted?.hasMedia) hadMedia = true;
        } catch (err) {
          console.error("[wa-webhook] erro a inserir mensagem", {
            wamid: msg?.id,
            direction,
            msgType: msg?.type,
            errInfo: serializeError(err),
          });
          const vaiTentarOutraVez = await recordFailure(supabase, {
            wamid: msg?.id ?? null,
            direction,
            msgType: msg?.type ?? null,
            phoneE164: phoneRaw,
            stage: "insert",
            err,
          });
          if (vaiTentarOutraVez) retryable += 1;
        }
      }
    }
  }
  return { hadMedia, retryable };
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
    reaction_target_wamid: msg.reaction?.message_id ?? null,
    is_edit: content.is_edit,
    received_at: receivedAt,
    meta_payload: msg as unknown as Record<string, unknown>,
  });

  if (error) {
    if (error.code === "23505") return null; // duplicate — wamid ja existe (idempotencia)
    throw error;
  }

  // Entrou à segunda (ou à terceira): fecha a falha que tinha ficado
  // registada, para a contagem de perdidas não mentir.
  after(async () => {
    try {
      await supabase
        .from("whatsapp_webhook_failures")
        .update({ resolved: true })
        .eq("wamid", msg.id)
        .eq("resolved", false);
    } catch {
      // registo de diagnóstico — não vale a pena falhar a mensagem por isto
    }
  });

  // "Apagar para todos": risca a mensagem original em vez de a deixar a
  // fingir que ainda existe na conversa.
  if (content.revoke_target_wamid) {
    const { error: revErr } = await supabase
      .from("whatsapp_messages")
      .update({ revoked_at: receivedAt })
      .eq("wamid", content.revoke_target_wamid)
      .is("revoked_at", null);
    if (revErr) {
      console.warn("[wa-webhook] nao consegui riscar a mensagem apagada", {
        alvo: content.revoke_target_wamid,
        err: revErr.message,
      });
    }
  }

  // Push ao António quando chega mensagem de cliente (não em ecos das
  // nossas respostas nem em reações). tag por conversa => uma rajada de
  // mensagens colapsa numa só notificação em vez de empilhar 10.
  // 'system' = anulação de uma mensagem apagada: não é conteúdo novo,
  // não vale uma notificação.
  if (
    direction === "received" &&
    content.content_type !== "reaction" &&
    content.content_type !== "system" &&
    ANTONIO_EMAIL
  ) {
    const sender = contactName ?? displayPhone;
    const preview = whatsappPreview(content.content_type, content.text);
    after(async () => {
      try {
        await sendPushToEmails(supabase, [ANTONIO_EMAIL], {
          title: `💬 ${sender}`,
          body: preview,
          url: "/whatsapp",
          tag: `wa-${conversationId}`,
        });
      } catch (err) {
        console.error("[wa-webhook] push falhou", serializeError(err));
      }
    });
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

function parseContent(msg: WaMessage): ParsedContent {
  const base = { is_edit: false, revoke_target_wamid: null };
  switch (msg.type) {
    case "text":
      return {
        ...base,
        content_type: "text",
        text: msg.text?.body ?? null,
        media_id: null,
        media_mime: null,
      };

    // Mensagem editada no WhatsApp. Vinha como 'unsupported' com text=NULL
    // e a conversa mostrava "(mensagem)" em itálico — 18 mensagens reais
    // perdidas à vista, incluindo cartas de clientes. O corpo novo está
    // em edit.message.text.body; a Meta dá-lhe um wamid próprio, por isso
    // entra como mensagem de pleno direito, marcada como editada.
    case "edit": {
      const body = msg.edit?.message?.text?.body ?? null;
      return {
        ...base,
        content_type: body ? "text" : "unsupported",
        text: body,
        media_id: null,
        media_mime: null,
        is_edit: true,
      };
    }

    // "Apagar para todos". Não é uma mensagem: é a anulação de outra.
    // Guardamos como 'system' (a UI não desenha balão) e o alvo é riscado
    // em insertMessage.
    case "revoke":
      return {
        ...base,
        content_type: "system",
        text: "Mensagem apagada pelo remetente",
        media_id: null,
        media_mime: null,
        revoke_target_wamid: msg.revoke?.original_message_id ?? null,
      };

    // Cartões de contacto partilhados: "Maria Silva — +351 912 345 678".
    case "contacts": {
      const cartoes = (msg.contacts ?? []).map((c) => {
        const nome =
          c.name?.formatted_name ||
          [c.name?.first_name, c.name?.last_name].filter(Boolean).join(" ") ||
          "Contacto";
        const numeros = (c.phones ?? [])
          .map((p) => p.phone)
          .filter((p): p is string => !!p);
        return numeros.length ? `${nome} — ${numeros.join(", ")}` : nome;
      });
      return {
        ...base,
        content_type: "contacts",
        text: cartoes.length ? cartoes.join(" | ") : null,
        media_id: null,
        media_mime: null,
      };
    }
    case "image":
      return {
        ...base,
        content_type: "image",
        text: msg.image?.caption ?? null,
        media_id: msg.image?.id ?? null,
        media_mime: msg.image?.mime_type ?? null,
      };
    case "video":
      return {
        ...base,
        content_type: "video",
        text: msg.video?.caption ?? null,
        media_id: msg.video?.id ?? null,
        media_mime: msg.video?.mime_type ?? null,
      };
    case "audio":
      return {
        ...base,
        content_type: "audio",
        text: null,
        media_id: msg.audio?.id ?? null,
        media_mime: msg.audio?.mime_type ?? null,
      };
    case "document":
      return {
        ...base,
        content_type: "document",
        text: msg.document?.caption ?? msg.document?.filename ?? null,
        media_id: msg.document?.id ?? null,
        media_mime: msg.document?.mime_type ?? null,
      };
    case "sticker":
      return {
        ...base,
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
      return { ...base, content_type: "location", text, media_id: null, media_mime: null };
    }
    case "reaction":
      return {
        ...base,
        content_type: "reaction",
        text: msg.reaction?.emoji ?? null,
        media_id: null,
        media_mime: null,
      };
    default:
      return {
        ...base,
        content_type: "unsupported",
        text: null,
        media_id: null,
        media_mime: null,
      };
  }
}
