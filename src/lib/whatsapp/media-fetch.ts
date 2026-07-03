// ============================================================
// Media fetch (WhatsApp → Drive)
// ============================================================
// Quando uma mensagem de WhatsApp chega com multimedia, o webhook insere
// a linha com media_pending=true e responde 200 a Meta.
//
// Esta funcao corre logo de seguida via Next.js `after()` (background,
// nao bloqueia a resposta). Pega nas mensagens pendentes, fetch ao
// graph.facebook.com para obter URL temporario (5min validade), download
// dos bytes, upload para a Drive (FBR Root/WhatsApp media/<phone>/file)
// e actualiza a linha com media_url_drive + media_pending=false.
//
// Em caso de falha, marca media_pending=false (nao retentamos a mesma
// mensagem para sempre — os URLs da Meta expiram em ~5min).
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { uploadWhatsappMedia } from "@/lib/google/drive";

const BATCH_SIZE = 10;
const META_GRAPH_VERSION = "v25.0";

type PendingMessage = {
  id: string;
  wamid: string;
  media_id: string;
  media_mime: string | null;
  content_type: string;
  conversation_id: string;
  received_at: string;
};

export async function fetchPendingMediaBatch(): Promise<void> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    console.warn("[wa-media] WHATSAPP_ACCESS_TOKEN em falta — skip");
    return;
  }

  const supabase = createAdminClient();
  const { data: pending, error } = await supabase
    .from("whatsapp_messages")
    .select("id, wamid, media_id, media_mime, content_type, conversation_id, received_at")
    .eq("media_pending", true)
    .not("media_id", "is", null)
    .order("received_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("[wa-media] erro a ler pendentes", error);
    return;
  }
  if (!pending || pending.length === 0) return;

  // Carregar phone das conversas de uma vez.
  const convIds = Array.from(new Set(pending.map((m) => m.conversation_id)));
  const { data: convs } = await supabase
    .from("whatsapp_conversations")
    .select("id, phone_e164")
    .in("id", convIds);
  const phoneByConvId = new Map<string, string>(
    (convs ?? []).map((c) => [c.id as string, c.phone_e164 as string]),
  );

  for (const msg of pending as PendingMessage[]) {
    const phone = phoneByConvId.get(msg.conversation_id);
    if (!phone) {
      await markFailed(supabase, msg.id, "sem conversa associada");
      continue;
    }
    try {
      await fetchOne(supabase, msg, phone, accessToken);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("[wa-media] falhou", { wamid: msg.wamid, reason });
      await markFailed(supabase, msg.id, reason);
    }
  }
}

async function fetchOne(
  supabase: ReturnType<typeof createAdminClient>,
  msg: PendingMessage,
  phoneE164: string,
  accessToken: string,
): Promise<void> {
  // 1. Metadados da media (incluindo URL temporario)
  const metaRes = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${msg.media_id}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!metaRes.ok) {
    const txt = await metaRes.text();
    throw new Error(`Meta API ${metaRes.status}: ${txt.slice(0, 200)}`);
  }
  const metaData = (await metaRes.json()) as {
    url?: string;
    mime_type?: string;
    file_size?: number;
  };
  if (!metaData.url) throw new Error("Meta nao devolveu URL");

  // 2. Download bytes
  const fileRes = await fetch(metaData.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileRes.ok) throw new Error(`Download ${fileRes.status}`);
  const arrayBuffer = await fileRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // 3. Upload Drive
  const mimeType = metaData.mime_type || msg.media_mime || "application/octet-stream";
  const ext = extFromMime(mimeType, msg.content_type);
  const tsPart = msg.received_at.replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${tsPart}-${msg.wamid.slice(-10)}.${ext}`;

  // Passa o client service_role: este código corre no webhook/after()
  // SEM sessão — com o client por defeito (sessão), a leitura de
  // google_integration corria como anon e falhava sempre à primeira
  // (as imagens só entravam na Drive pelo botão de retry de um admin).
  const { id: driveFileId, url: driveUrl } = await uploadWhatsappMedia(
    { phoneE164, filename, mimeType, buffer },
    supabase,
  );

  // 4. Update mensagem
  const { error } = await supabase
    .from("whatsapp_messages")
    .update({
      media_url_drive: driveUrl,
      media_drive_file_id: driveFileId,
      media_pending: false,
    })
    .eq("id", msg.id);
  if (error) throw new Error(`update DB: ${error.message}`);
}

async function markFailed(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
  reason: string,
): Promise<void> {
  await supabase
    .from("whatsapp_messages")
    .update({ media_pending: false })
    .eq("id", id);
  console.warn("[wa-media] marcado nao-pending por falha", { id, reason });
}

function extFromMime(mime: string, contentType: string): string {
  const m = mime.toLowerCase();
  if (m.includes("jpeg")) return "jpg";
  if (m.includes("jpg")) return "jpg";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("mp4")) return "mp4";
  if (m.includes("video/3gp") || m.includes("3gpp")) return "3gp";
  if (m.includes("opus")) return "opus";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("amr")) return "amr";
  if (m.includes("aac")) return "aac";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("zip")) return "zip";
  if (m.includes("plain")) return "txt";
  // Fallback por content_type
  if (contentType === "sticker") return "webp";
  if (contentType === "audio") return "ogg";
  return "bin";
}
