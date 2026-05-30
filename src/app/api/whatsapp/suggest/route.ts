import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { CLAUDE_MODEL, createAnthropicClient } from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mensagens recentes para o contexto (mais que isto desperdica tokens
// sem melhorar qualidade).
const RECENT_MESSAGES_LIMIT = 20;
const MAX_TOKENS = 1024;

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
  const { data: tplData } = await supabase
    .from("message_templates")
    .select("name, language, category, body")
    .is("deleted_at", null)
    .order("category", { ascending: true })
    .order("position", { ascending: true });
  const templates = (tplData ?? []) as Array<{
    name: string;
    language: "pt" | "en";
    category: string;
    body: string;
  }>;

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
  // Inclui persona FBR + todos os templates como referencia de estilo.
  const systemPersona = `És a Maria João da Flores à Beira-Rio (FBR), estúdio de preservação de flores em Coimbra.

A tua voz:
- Português europeu (não brasileiro)
- Calorosa mas profissional, sem ser informal demais
- Atenciosa: tratar as clientes como noivas/pessoas que confiam algo precioso (as flores do dia especial)
- Eficiente: não enrolar
- Usa emojis com moderação (🌸 🌷 🌻 🤍 💐) — nunca exagerar
- Em PT trata sempre por "a senhora"/"vocês"; nunca "você" directo
- Saudação contextual ("Bom dia"/"Boa tarde"/"Boa noite" conforme hora)

Quando responder em INGLÊS:
- Tom equivalente: warm but professional, atencioso
- A Maria fala inglês mas não é fluente — mantém frases simples e claras
- Não incluir convite para chamada telefónica (memória de equipa: Ana não fala EN; convites só em PT)

Regra: a tua resposta vai ser COPIADA pela Maria para a app WhatsApp Business. Escreve a resposta directa, sem "Aqui está a sugestão:" nem aspas a envolver. Apenas o texto a enviar.

Se a conversa precisa de informação que não tens (ex: data do evento que a cliente perguntou), assinala com [CONFIRMAR: ...] em vez de inventar.`;

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
  let usage: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } = {};
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: "text",
          text: systemPersona,
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
    usage = response.usage as typeof usage;
  } catch (err) {
    console.error("[wa-suggest] anthropic error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "anthropic error" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    suggestion,
    language: probableLang,
    usage,
  });
}
