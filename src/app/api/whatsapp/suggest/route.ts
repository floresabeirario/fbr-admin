import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentRole, getCurrentEmail } from "@/lib/auth/server";
import {
  CLAUDE_MODEL,
  createAnthropicClient,
  calculateClaudeCostUsd,
  type ClaudeUsage,
} from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mensagens recentes para o contexto (mais que isto desperdica tokens
// sem melhorar qualidade).
const RECENT_MESSAGES_LIMIT = 20;
const MAX_TOKENS = 1024;

// Fallback se system_settings.claude_persona estiver vazio (nao deveria
// acontecer apos mig 063, mas defensivo).
const PERSONA_FALLBACK = `És a Maria João da Flores à Beira-Rio (FBR), estúdio de preservação de flores em Coimbra. Português europeu, tom caloroso mas profissional, eficiente, emojis com moderação. Tratamento "a senhora"/"vocês" em PT. Resposta directa para copiar — sem prefácios.`;

type ReqBody = {
  conversationId: string;
  instruction?: string; // ex: "diz que sim, conseguimos fazer"
};

export async function POST(request: NextRequest) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as ReqBody;
  if (!body?.conversationId) {
    return NextResponse.json({ error: "conversationId em falta" }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. Conversa + ultimas mensagens
  const { data: conv } = await supabase
    .from("whatsapp_conversations")
    .select("id, phone_e164, display_phone, contact_name, notes")
    .eq("id", body.conversationId)
    .single();
  if (!conv) {
    return NextResponse.json({ error: "conversa nao encontrada" }, { status: 404 });
  }

  const { data: msgs } = await supabase
    .from("whatsapp_messages")
    .select("direction, content_type, text, received_at")
    .eq("conversation_id", body.conversationId)
    .order("received_at", { ascending: false })
    .limit(RECENT_MESSAGES_LIMIT);

  const recentMessages = (msgs ?? []).reverse() as Array<{
    direction: "received" | "sent_echo";
    content_type: string;
    text: string | null;
    received_at: string;
  }>;

  // 2. Templates (todos PT e EN — Claude decide qual estilo aplicar
  //    consoante a lingua da conversa)
  const [tplDataRes, settingsRes] = await Promise.all([
    supabase
      .from("message_templates")
      .select("name, language, category, body")
      .is("deleted_at", null)
      .order("category", { ascending: true })
      .order("position", { ascending: true }),
    supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["claude_persona", "claude_facts"]),
  ]);
  const templates = (tplDataRes.data ?? []) as Array<{
    name: string;
    language: "pt" | "en";
    category: string;
    body: string;
  }>;
  const settingsMap = Object.fromEntries(
    (settingsRes.data ?? []).map((r) => [r.key as string, r.value as string]),
  );
  const personaFromDb = (settingsMap.claude_persona ?? "").trim();
  const factsFromDb = (settingsMap.claude_facts ?? "").trim();

  // 3. Encomendas associadas a esta pessoa (por telefone)
  // O matching e por digitos last 9 — espelhada do client side.
  const phoneDigits = conv.phone_e164.replace(/\D/g, "");
  const phoneTail = phoneDigits.slice(-9);
  const { data: allOrders } = await supabase
    .from("orders")
    .select(
      "order_id, client_name, status, event_date, event_type, frame_size, total_budget, phone, payment_status",
    )
    .not("phone", "is", null)
    .is("deleted_at", null)
    .limit(2000);
  const linkedOrders = (allOrders ?? []).filter((o) =>
    (o.phone ?? "").replace(/\D/g, "").slice(-9) === phoneTail,
  );

  // 4. Detectar lingua provavel (PT default; se as ultimas msgs recebidas
  //    parecerem EN, usa EN). Heuristica simples: presenca de palavras EN
  //    comuns sem caracteres unicamente PT.
  const lastReceived = recentMessages.filter((m) => m.direction === "received").slice(-3);
  const recentText = lastReceived.map((m) => m.text ?? "").join(" ").toLowerCase();
  const englishHints = /\b(the|you|your|thank|please|hello|hi|good morning|i'm)\b/;
  const portugueseHints = /[áàâãéêíóôõúç]|\b(obrigad|olá|boa tarde|bom dia|noivo|querida)\b/;
  const probableLang: "pt" | "en" =
    englishHints.test(recentText) && !portugueseHints.test(recentText) ? "en" : "pt";

  // 5. Montar prompt

  const conversationTranscript = recentMessages
    .map((m) => {
      const tag = m.direction === "received" ? "CLIENTE" : "FBR";
      const content = m.text || `(${m.content_type})`;
      return `${tag}: ${content}`;
    })
    .join("\n");

  const ordersBlock = linkedOrders.length
    ? linkedOrders
        .slice(0, 3)
        .map(
          (o) =>
            `- Encomenda ${o.order_id}: ${o.client_name ?? "?"} — estado: ${o.status}, evento: ${o.event_date ?? "?"} (${o.event_type ?? "?"}), moldura: ${o.frame_size ?? "?"}, orçamento: ${o.total_budget ?? "?"}€, pagamento: ${o.payment_status ?? "?"}`,
        )
        .join("\n")
    : "Sem encomenda associada (lead).";

  const notesBlock = conv.notes ? `\n\nNotas guardadas sobre esta pessoa:\n${conv.notes}` : "";

  // ─── System prompt (cacheable) ───
  // Persona vem de system_settings.claude_persona; se vazio, fallback hardcoded.
  // Factos vem de system_settings.claude_facts; se vazio, omite a seccao.
  const systemPersona = personaFromDb || PERSONA_FALLBACK;
  const systemFacts = factsFromDb
    ? `\n\n## Factos e contexto adicional da FBR (sabe sempre)\n\n${factsFromDb}`
    : "";

  const templatesAsReference = templates
    .map((t) => `### ${t.name} (${t.language}, ${t.category})\n${t.body}`)
    .join("\n\n---\n\n");

  const userTask = `## Conversa actual com ${conv.contact_name ?? conv.display_phone ?? conv.phone_e164}

${conversationTranscript || "(ainda sem mensagens)"}

## Encomendas ligadas a este número

${ordersBlock}${notesBlock}

## Instrução da Maria

${body.instruction?.trim() ? body.instruction.trim() : "(sem instrução específica — interpreta o contexto e responde como a Maria responderia)"}

## Língua

Responder em **${probableLang === "en" ? "inglês" : "português europeu"}**.

Gera a próxima mensagem da FBR (pronta a copiar):`;

  // ─── Chamada Claude ───
  const anthropic = createAnthropicClient();

  let suggestion: string;
  let usage: ClaudeUsage = {};
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: systemPersona + systemFacts,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: `## Biblioteca de templates da FBR (usa como referência de TOM e ESTILO; não copies)\n\n${templatesAsReference}`,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: userTask,
        },
      ],
    });

    const firstBlock = response.content[0];
    suggestion = firstBlock?.type === "text" ? firstBlock.text : "";
    usage = response.usage as ClaudeUsage;
  } catch (err) {
    console.error("[wa-suggest] anthropic error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "anthropic error" },
      { status: 500 },
    );
  }

  // Log de uso para cost tracking (best-effort — nao bloqueia resposta)
  try {
    const admin = createAdminClient();
    const cost = calculateClaudeCostUsd(usage);
    const email = await getCurrentEmail();
    await admin.from("claude_usage").insert({
      model: CLAUDE_MODEL,
      conversation_id: body.conversationId,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
      cost_usd: cost,
      caller_email: email,
    });
  } catch (err) {
    console.warn("[wa-suggest] falhou a logar uso", err);
  }

  return NextResponse.json({
    suggestion,
    language: probableLang,
    usage,
  });
}
