import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/google/oauth";
import { getCurrentEmail } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ fileId: string }> };

// Proxy autenticado para servir ficheiros da Drive da FBR. Usado pelas
// bolhas de imagem para fazer <img src='/api/whatsapp/media/<id>'>.
//
// Auth: qualquer um dos 3 utilizadores (a leitura de whatsapp_messages
// corre com a sessão do utilizador — a RLS team_read é quem decide).
//
// Só serve ficheiros que estejam em whatsapp_messages.media_drive_file_id
// — sem isto, qualquer sessão podia usar a rota como proxy de leitura
// para QUALQUER ficheiro da Drive da FBR (auditoria da sessão 124).
//
// O refresh_token do OAuth é lido com service_role DEPOIS destas duas
// verificações: a RLS de google_integration é só-admins e a Ana ficava
// com as imagens partidas (503) se usássemos a sessão dela.
//
// Cache: 'private, max-age=86400, immutable' — browser cacheia por 24h
// e nao re-pede (file_id e estavel).
export async function GET(_request: NextRequest, ctx: Ctx) {
  const email = await getCurrentEmail();
  if (!email) {
    return new Response("unauthorized", { status: 401 });
  }

  const { fileId } = await ctx.params;
  if (!fileId) {
    return new Response("fileId em falta", { status: 400 });
  }

  // O ficheiro tem de pertencer a uma mensagem de WhatsApp. Query com a
  // sessão do utilizador: se a RLS não deixar ler, é como não existir.
  const supabase = await createClient();
  const { data: msg } = await supabase
    .from("whatsapp_messages")
    .select("id")
    .eq("media_drive_file_id", fileId)
    .limit(1)
    .maybeSingle();
  if (!msg) {
    return new Response("not found", { status: 404 });
  }

  const admin = createAdminClient();
  const { data: integration } = await admin
    .from("google_integration")
    .select("refresh_token")
    .limit(1)
    .maybeSingle();
  if (!integration?.refresh_token) {
    return new Response("Google nao conectada", { status: 503 });
  }

  const oauth = getOAuthClient();
  oauth.setCredentials({ refresh_token: integration.refresh_token });
  const drive = google.drive({ version: "v3", auth: oauth });

  try {
    // 1. Metadados para descobrir mime type
    const meta = await drive.files.get({
      fileId,
      fields: "mimeType, name, size",
      supportsAllDrives: true,
    });
    const mime = meta.data.mimeType || "application/octet-stream";
    const size = meta.data.size ?? null;

    // 2. Bytes em streaming
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" },
    );

    const nodeStream = res.data as unknown as Readable;
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

    const headers: Record<string, string> = {
      "content-type": mime,
      "cache-control": "private, max-age=86400, immutable",
    };
    if (size) headers["content-length"] = String(size);

    return new Response(webStream, { headers });
  } catch (err) {
    console.error("[wa-media-proxy] erro", {
      fileId,
      msg: err instanceof Error ? err.message : String(err),
    });
    return new Response("not found", { status: 404 });
  }
}
