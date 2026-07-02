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
import { dadosPagamento, fieldSuggestionBases } from "@/lib/templates";
import type { SystemSettingsMap } from "@/types/message-template";
import {
  STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  FLOWER_DELIVERY_METHOD_LABELS,
  FRAME_DELIVERY_METHOD_LABELS,
  FRAME_BACKGROUND_LABELS,
  FRAME_SIZE_LABELS,
  type OrderStatus,
  type PaymentStatus,
  type EventType,
  type FlowerDeliveryMethod,
  type FrameDeliveryMethod,
  type FrameBackground,
  type FrameSize,
} from "@/types/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mensagens recentes para o contexto (mais que isto desperdica tokens
// sem melhorar qualidade).
const RECENT_MESSAGES_LIMIT = 20;
const MAX_TOKENS = 1024;

// Fallback se system_settings.claude_persona estiver vazio (nao deveria
// acontecer apos mig 080, mas defensivo).
const PERSONA_FALLBACK = `És a Maria João da Flores à Beira-Rio (FBR), estúdio de preservação de flores em Coimbra. Português europeu, tom caloroso mas profissional, eficiente, emojis com moderação. Tratamento "a senhora"/"vocês" em PT. Responde SEMPRE na língua das últimas mensagens do cliente. Resposta directa para copiar — sem prefácios.`;

type ReqBody = {
  conversationId: string;
  instruction?: string; // ex: "diz que sim, conseguimos fazer"
};

// Campos da encomenda que passamos ao Claude (nomes reais das colunas —
// atenção: a coluna do orçamento chama-se `budget`, não `total_budget`).
type LinkedOrder = {
  order_id: string;
  client_name: string | null;
  status: OrderStatus;
  contacted: boolean;
  event_date: string | null;
  event_type: EventType | null;
  event_location: string | null;
  couple_names: string | null;
  frame_size: FrameSize | null;
  frame_background: FrameBackground | null;
  flower_delivery_method: FlowerDeliveryMethod | null;
  frame_delivery_method: FrameDeliveryMethod | null;
  budget: number | null;
  budget_at_first_payment: number | null;
  payment_status: PaymentStatus;
  cash_on_delivery: boolean;
  pickup_address: string | null;
  pickup_date: string | null;
  gift_voucher_code: string | null;
  additional_notes: string | null;
  form_language: "pt" | "en";
  estimated_delivery_date: string | null;
  phone: string | null;
};

const LINKED_ORDER_COLUMNS =
  "order_id, client_name, status, contacted, event_date, event_type, event_location, couple_names, frame_size, frame_background, flower_delivery_method, frame_delivery_method, budget, budget_at_first_payment, payment_status, cash_on_delivery, pickup_address, pickup_date, gift_voucher_code, additional_notes, form_language, estimated_delivery_date, phone";

function labelOr(value: string | null, labels: Record<string, string>): string {
  if (!value) return "não preenchido";
  return labels[value] ?? value;
}

function orderToBlock(o: LinkedOrder): string {
  const lines = [
    `- Encomenda ${o.order_id} — ${o.client_name ?? "?"}`,
    `  Estado: ${STATUS_LABELS[o.status] ?? o.status} | Pagamento: ${PAYMENT_STATUS_LABELS[o.payment_status] ?? o.payment_status} | Orçamento: ${o.budget !== null ? `${o.budget}€` : "por calcular"}`,
    `  Evento: ${labelOr(o.event_type, EVENT_TYPE_LABELS)} a ${o.event_date ?? "?"}${o.event_location ? ` em ${o.event_location}` : ""}${o.couple_names ? ` (${o.couple_names})` : ""}`,
    `  Quadro: tamanho ${labelOr(o.frame_size, FRAME_SIZE_LABELS)}, fundo ${labelOr(o.frame_background, FRAME_BACKGROUND_LABELS)}`,
    `  Envio das flores: ${labelOr(o.flower_delivery_method, FLOWER_DELIVERY_METHOD_LABELS)} | Receção do quadro: ${labelOr(o.frame_delivery_method, FRAME_DELIVERY_METHOD_LABELS)}`,
    `  Língua do formulário: ${o.form_language === "en" ? "inglês" : "português"} | Contactada: ${o.contacted ? "sim" : "não"}`,
  ];
  if (o.cash_on_delivery) {
    lines.push("  Pagamento combinado em DINHEIRO na entrega das flores");
  }
  if (o.budget_at_first_payment !== null) {
    lines.push(
      `  Sinal pago sobre orçamento de ${o.budget_at_first_payment}€ (tamanho decidido depois → pode haver acerto de valores)`,
    );
  }
  if (o.pickup_address) {
    lines.push(`  Recolha: ${o.pickup_address}${o.pickup_date ? ` a ${o.pickup_date}` : ""}`);
  }
  if (o.gift_voucher_code) lines.push(`  Paga com vale-presente: ${o.gift_voucher_code}`);
  if (o.estimated_delivery_date) lines.push(`  Previsão de entrega: ${o.estimated_delivery_date}`);
  if (o.additional_notes) lines.push(`  Notas do cliente no formulário: ${o.additional_notes}`);
  lines.push(`  Link de acompanhamento: https://status.floresabeirario.pt/${o.order_id}`);
  return lines.join("\n");
}

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

  // 2. Templates (todos PT e EN) + settings (persona, factos e dados de
  //    pagamento — o Claude precisa dos dados reais para compor mensagens
  //    de sinal/parcelas sem inventar).
  const [tplDataRes, settingsRes] = await Promise.all([
    supabase
      .from("message_templates")
      .select("name, language, category, body")
      .is("deleted_at", null)
      .order("category", { ascending: true })
      .order("position", { ascending: true }),
    supabase.from("system_settings").select("key, value"),
  ]);
  const templates = (tplDataRes.data ?? []) as Array<{
    name: string;
    language: "pt" | "en";
    category: string;
    body: string;
  }>;
  const settingsMap = Object.fromEntries(
    (settingsRes.data ?? []).map((r) => [r.key as string, r.value as string]),
  ) as Partial<SystemSettingsMap>;
  const personaFromDb = (settingsMap.claude_persona ?? "").trim();
  const factsFromDb = (settingsMap.claude_facts ?? "").trim();

  // 3. Encomendas associadas a esta pessoa (por telefone)
  // O matching e por digitos last 9 — espelhada do client side.
  const phoneDigits = conv.phone_e164.replace(/\D/g, "");
  const phoneTail = phoneDigits.slice(-9);
  const { data: allOrders, error: ordersError } = await supabase
    .from("orders")
    .select(LINKED_ORDER_COLUMNS)
    .not("phone", "is", null)
    .is("deleted_at", null)
    .limit(2000);
  if (ordersError) {
    // Nao silenciar: sem encomendas o Claude trata clientes como leads.
    console.error("[wa-suggest] falhou a query de orders", ordersError);
  }
  const linkedOrders = ((allOrders ?? []) as LinkedOrder[]).filter(
    (o) => (o.phone ?? "").replace(/\D/g, "").slice(-9) === phoneTail,
  );

  // 4. Lingua provavel — dica, nao regra. A regra (na persona) e responder
  //    na lingua das ultimas mensagens do cliente; quando a conversa ainda
  //    nao diz nada, vale a lingua do formulario da encomenda ligada.
  const lastReceived = recentMessages.filter((m) => m.direction === "received").slice(-3);
  const recentText = lastReceived.map((m) => m.text ?? "").join(" ").toLowerCase();
  const englishHints = /\b(the|you|your|thank|thanks|please|hello|hi|good morning|i'm|i am|would|could)\b/;
  const portugueseHints = /[áàâãéêíóôõúç]|\b(obrigad|olá|ola|boa tarde|bom dia|boa noite|casei|gostaria|sim|noiv)\b/;
  let probableLang: "pt" | "en";
  if (englishHints.test(recentText) && !portugueseHints.test(recentText)) {
    probableLang = "en";
  } else if (recentText.trim() && portugueseHints.test(recentText)) {
    probableLang = "pt";
  } else {
    probableLang = linkedOrders[0]?.form_language ?? "pt";
  }

  // 5. Montar prompt

  const conversationTranscript = recentMessages
    .map((m) => {
      const tag = m.direction === "received" ? "CLIENTE" : "FBR";
      const content = m.text || `(${m.content_type})`;
      return `${tag}: ${content}`;
    })
    .join("\n");

  const ordersBlock = linkedOrders.length
    ? linkedOrders.slice(0, 3).map(orderToBlock).join("\n\n")
    : "Sem encomenda associada — provavelmente é um lead (primeiro contacto). Usa os templates de primeiro contacto conforme a situação.";

  // Templates que as regras de campos sugerem para a encomenda principal
  // (ex: envio "não sei" → apresentar as 3 opções de entrega).
  const suggestionBases = linkedOrders.length
    ? fieldSuggestionBases(linkedOrders[0])
    : [];
  const suggestionsBlock = suggestionBases.length
    ? `\n\n## Templates mais prováveis para esta fase (pelas regras da FBR)\n\n${suggestionBases.map((b) => `- ${b}`).join("\n")}`
    : "";

  const notesBlock = conv.notes ? `\n\nNotas guardadas sobre esta pessoa:\n${conv.notes}` : "";

  // ─── System prompt (cacheable) ───
  // Persona vem de system_settings.claude_persona; se vazio, fallback hardcoded.
  // Factos vem de system_settings.claude_facts; se vazio, omite a seccao.
  const systemPersona = personaFromDb || PERSONA_FALLBACK;
  const systemFacts = factsFromDb
    ? `\n\n## Factos e contexto adicional da FBR (sabe sempre)\n\n${factsFromDb}`
    : "";

  // Dados de pagamento reais (variavel {dados_pagamento} dos templates).
  // Merge com defaults vazios para nunca imprimir "undefined".
  const settingsForPayment: SystemSettingsMap = {
    payment_account_holder: "",
    payment_iban: "",
    payment_bic: "",
    payment_bank_name: "",
    payment_mbway: "",
    studio_address_url: "",
    studio_address_text: "",
    review_link: "",
    claude_persona: "",
    claude_facts: "",
    ...settingsMap,
  };
  const paymentBlock =
    settingsMap.payment_iban || settingsMap.payment_mbway
      ? `\n\n## Dados de pagamento reais (usar tal e qual; nunca inventar)\n\nPara clientes portugueses:\n${dadosPagamento("pt", settingsForPayment)}\n\nPara clientes internacionais (MB Way não funciona fora de PT):\n${dadosPagamento("en", settingsForPayment)}${settingsMap.studio_address_url ? `\n\nPonto de encontro / entrega em mãos (link Maps): ${settingsMap.studio_address_url}` : ""}${settingsMap.review_link ? `\nLink de avaliação/opinião: ${settingsMap.review_link}` : ""}`
      : "";

  const templatesAsReference = templates
    .map((t) => `### ${t.name} [${t.language}] (${t.category})\n${t.body}`)
    .join("\n\n---\n\n");

  const userTask = `## Conversa actual com ${conv.contact_name ?? conv.display_phone ?? conv.phone_e164}

${conversationTranscript || "(ainda sem mensagens)"}

## Encomendas ligadas a este número

${ordersBlock}${suggestionsBlock}${notesBlock}

## Instrução da Maria

${body.instruction?.trim() ? body.instruction.trim() : "(sem instrução específica — interpreta o contexto e responde como a Maria responderia)"}

## Língua

Responde na língua das últimas mensagens do CLIENTE (não da FBR). Se o cliente escrever em francês, espanhol ou outra língua, responde nessa língua. Se a conversa ainda não permitir perceber, usa: **${probableLang === "en" ? "inglês" : "português europeu"}**.

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
          text: systemPersona + systemFacts + paymentBlock,
          cache_control: { type: "ephemeral" },
        },
        {
          type: "text",
          text: `## Biblioteca oficial de templates da FBR\n\nEstas são as mensagens validadas pela Maria, em PT e EN. Quando a situação da conversa corresponde a um template, USA o template como base: mantém a estrutura e as frases, adapta apenas nome, valores, datas e detalhes ao contexto (e remove variáveis {assim} substituindo pelo valor real ou por [CONFIRMAR: ...] se não o souberes). Para situações sem template, escreve uma mensagem nova no mesmo estilo.\n\n${templatesAsReference}`,
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
