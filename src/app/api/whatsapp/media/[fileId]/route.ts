import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { google } from "googleapis";
import { getOAuthClient, loadIntegration } from "@/lib/google/oauth";
import { getCurrentEmail } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ fileId: string }> };

// Proxy autenticado para servir ficheiros da Drive da FBR. Usado pelas
// bolhas de imagem para fazer <img src='/api/whatsapp/media/<id>'>.
//
// Auth: qualquer um dos 3 utilizadores. Drive: usa o OAuth da
// integracao FBR (info@floresabeirario.pt).
//
// Cache: 'private, max-age=86400, immutable' — browser cacheia por 24h
// e nao re-pede (file_id e estavel).
export async function GET(_request: NextRequest, ctx: Ctx) {
  const email = await getCurrentEmail();
  if (!email) {
    return new Response("unauthorized", { status: 401 });
  }

  const integration = await loadIntegration();
  if (!integration?.refresh_token) {
    return new Response("Google nao conectada", { status: 503 });
  }

  const { fileId } = await ctx.params;
  if (!fileId) {
    return new Response("fileId em falta", { status: 400 });
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
