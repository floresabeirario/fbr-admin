import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentRole } from "@/lib/auth/server";
import { fetchPendingMediaBatch } from "@/lib/whatsapp/media-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Forca retry de uma mensagem que falhou: marca media_pending=true e
// dispara o batch fetch. Se a URL da Meta ja expirou (>5min), o fetch
// vai falhar de novo — mas ao menos confirma.
export async function POST(request: NextRequest) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { messageId?: string };
  if (!body.messageId) {
    return NextResponse.json({ error: "messageId em falta" }, { status: 400 });
  }

  const supabase = await createClient();
  // Verifica que a mensagem existe e tem media_id (autorizado pelo role admin).
  const { data: msg } = await supabase
    .from("whatsapp_messages")
    .select("id, media_id, media_url_drive")
    .eq("id", body.messageId)
    .single();
  if (!msg) {
    return NextResponse.json({ error: "mensagem nao encontrada" }, { status: 404 });
  }
  if (!msg.media_id) {
    return NextResponse.json({ error: "sem media para puxar" }, { status: 400 });
  }
  if (msg.media_url_drive) {
    return NextResponse.json({ error: "ja foi puxada" }, { status: 400 });
  }

  // Re-marca como pendente (usando service role — bypassa RLS) e corre
  // o batch fetch que vai apanhar esta + outras pendentes.
  const admin = createAdminClient();
  await admin
    .from("whatsapp_messages")
    .update({ media_pending: true })
    .eq("id", body.messageId);

  try {
    await fetchPendingMediaBatch();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "erro" },
      { status: 500 },
    );
  }

  // Lê o estado depois do batch para responder se conseguiu ou nao.
  const { data: after } = await supabase
    .from("whatsapp_messages")
    .select("media_pending, media_url_drive")
    .eq("id", body.messageId)
    .single();

  return NextResponse.json({
    ok: !!after?.media_url_drive,
    media_url_drive: after?.media_url_drive ?? null,
  });
}
