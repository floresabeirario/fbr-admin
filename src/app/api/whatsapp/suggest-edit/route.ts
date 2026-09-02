// ============================================================
// Captura do par sugestão-gerada / texto-realmente-usado
// ============================================================
// Chamada quando a Maria carrega em "Copiar" ou "Abrir no WhatsApp".
// É o momento certo: é aí que ela decidiu que aquele texto serve, e o
// que está na caixa é o que ela vai mesmo enviar.
//
// Silenciosa de propósito: sem toast, sem botão, sem confirmação. A
// Maria não quer "mais uma coisa para fazer" — a aprendizagem tem de
// ser um efeito secundário de algo que ela já faz.
//
// Best-effort em todos os passos: se isto falhar, a mensagem dela sai na
// mesma. Nunca bloquear o trabalho por causa da telemetria.
// ============================================================

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentRole, getCurrentEmail } from "@/lib/auth/server";
import { CLAUDE_MODEL } from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Textos maiores que isto são quase de certeza colagem de outra coisa
// que não a sugestão. Não vale a pena guardar nem analisar.
const MAX_LEN = 8000;

type ReqBody = {
  // Um dos dois: conversa do WhatsApp, ou encomenda sem conversa
  // (mensagem gerada a partir do formulário, no workbench).
  conversationId?: string | null;
  orderId?: string | null;
  instruction?: string | null;
  original: string;
  final: string;
  usedVia?: "copiar" | "whatsapp";
  language?: string | null;
};

/**
 * Compara ignorando diferenças que não são edições da Maria: espaços a
 * mais, quebras de linha diferentes, espaço no fim. Sem isto, quase
 * tudo apareceria como "editado" e a análise ficava cega ao que já está
 * bom.
 */
function foiEditado(original: string, final: string): boolean {
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  return norm(original) !== norm(final);
}

export async function POST(request: NextRequest) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: ReqBody;
  try {
    body = (await request.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "json inválido" }, { status: 400 });
  }

  const original = (body.original ?? "").trim();
  const final = (body.final ?? "").trim();
  if ((!body.conversationId && !body.orderId) || !original || !final) {
    return NextResponse.json({ error: "campos em falta" }, { status: 400 });
  }
  if (original.length > MAX_LEN || final.length > MAX_LEN) {
    // Não é erro do ponto de vista da Maria — só não guardamos.
    return NextResponse.json({ ok: true, skipped: "demasiado longo" });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("suggestion_edits").insert({
      conversation_id: body.conversationId ?? null,
      order_id: body.orderId ?? null,
      instruction: body.instruction?.trim() || null,
      suggestion_original: original,
      suggestion_final: final,
      edited: foiEditado(original, final),
      used_via: body.usedVia === "whatsapp" ? "whatsapp" : "copiar",
      language: body.language ?? null,
      model: CLAUDE_MODEL,
      caller_email: await getCurrentEmail(),
    });
    if (error) {
      // Erro mais provável: a migração 102 ainda não foi corrida.
      console.warn("[suggest-edit] insert falhou", error.message);
      return NextResponse.json({ ok: false }, { status: 200 });
    }
  } catch (err) {
    console.warn("[suggest-edit] falhou", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}
