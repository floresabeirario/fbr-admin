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
import {
  dadosPagamento,
  fieldSuggestionBases,
  requiredContentPoints,
  resumoEncomendaLinhas,
} from "@/lib/templates";
import {
  pickVoiceExamples,
  preencherNome,
  voiceExamplesBlock,
} from "@/lib/whatsapp/voice-examples";
import { fetchThreadsWithContact } from "@/lib/google/gmail";
import { splitQuotedEmail } from "@/lib/email-quotes";
import { formatDateLisbon } from "@/lib/format-date";
import { normalizeBold } from "@/lib/rich-text";
import type { SystemSettingsMap } from "@/types/message-template";
import {
  STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  FLOWER_DELIVERY_METHOD_LABELS,
  FRAME_DELIVERY_METHOD_LABELS,
  FRAME_BACKGROUND_LABELS,
  FRAME_SIZE_LABELS,
  YES_NO_INFO_LABELS,
  type ExtrasInFrame,
  type YesNoInfo,
  type OrderStatus,
  type PaymentStatus,
  type EventType,
  type FlowerDeliveryMethod,
  type FrameDeliveryMethod,
  type FrameBackground,
  type FrameSize,
  type Order,
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
  // Alvo: um dos dois. `conversationId` quando ela responde a uma
  // conversa; `orderId` quando o cliente preencheu o formulário e nunca
  // escreveu — aí não há conversa nenhuma para abrir, mas há tudo o que
  // ele escolheu, que é o que interessa para a primeira mensagem.
  conversationId?: string;
  orderId?: string;
  // Canal de saída. Por omissão WhatsApp (a esmagadora maioria). "email"
  // muda o formato da mensagem — assunto, saudação, despedida — porque
  // uma mensagem de WhatsApp colada num email lê-se mal.
  channel?: "whatsapp" | "email";
  instruction?: string; // ex: "diz que sim, conseguimos fazer"
  // Afinação: a Maria já tem uma versão e quer mudá-la ("mais curta",
  // "sem emojis", "diz que só depois de Agosto"). Sem isto ela só podia
  // aceitar o que saiu ou mandar refazer do zero e perder o que estava bom.
  refineFrom?: string; // a versão actual, tal como está na caixa dela
  refineWith?: string; // o que quer mudar
  // "Refazer": versões já geradas nesta conversa. O prompt é idêntico
  // entre chamadas e a tarefa é muito constrangida (templates, pontos
  // obrigatórios, factos fixos), por isso o modelo convergia para a
  // MESMA mensagem e o botão parecia não fazer nada. Mostrar-lhe o que
  // já tentou é o que o obriga a mudar de caminho.
  avoid?: string[];
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
  // Para ir buscar os emails trocados com esta pessoa (o histórico do
  // Gmail entra no prompt a par do WhatsApp).
  email: string | null;
  // Escolhas do cliente no formulário que o assistente tem de conhecer
  // para não responder às cegas (sessão 152). Os "Mais info" viram
  // pontos obrigatórios via requiredContentPoints().
  flower_type: string | null;
  extras_in_frame: ExtrasInFrame | null;
  christmas_ornaments: YesNoInfo | null;
  christmas_ornaments_qty: number | null;
  necklace_pendants: YesNoInfo | null;
  necklace_pendants_qty: number | null;
  extra_small_frames: YesNoInfo | null;
  extra_small_frames_qty: number | null;
  // Decomposição do orçamento (quadro + extras). Sem isto o assistente só
  // sabia o total e falava sempre do quadro, nunca dos ornamentos.
  pricing_snapshot: Order["pricing_snapshot"];
};

type ConvRow = {
  id: string;
  phone_e164: string;
  display_phone: string | null;
  contact_name: string | null;
  notes: string | null;
};

const LINKED_ORDER_COLUMNS =
  "order_id, client_name, status, contacted, event_date, event_type, event_location, couple_names, frame_size, frame_background, flower_delivery_method, frame_delivery_method, budget, budget_at_first_payment, payment_status, cash_on_delivery, pickup_address, pickup_date, gift_voucher_code, additional_notes, form_language, estimated_delivery_date, phone, email, flower_type, extras_in_frame, christmas_ornaments, christmas_ornaments_qty, necklace_pendants, necklace_pendants_qty, extra_small_frames, extra_small_frames_qty, pricing_snapshot";

// ─── Histórico de email ───────────────────────────────────────
// O WhatsApp não é a história toda: muita coisa combina-se por email
// (orçamentos, moradas, datas). Sem isto o assistente podia contradizer
// o que já tinha ficado escrito no outro canal.
// Custa uma chamada ao Gmail por sugestão; se falhar ou o Google não
// estiver ligado, segue-se só com o WhatsApp em vez de rebentar.
const EMAIL_HISTORY_LIMIT = 8;
const EMAIL_BODY_CHARS = 700;

async function fetchEmailHistory(clientEmail: string | null | undefined): Promise<string> {
  const email = (clientEmail ?? "").trim();
  if (!email.includes("@")) return "";
  try {
    const res = await fetchThreadsWithContact(email);
    if (res.status !== "ok" || res.threads.length === 0) return "";
    const todas = res.threads.flatMap((t) =>
      t.messages.map((m) => ({ ...m, subject: t.subject })),
    );
    todas.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    return todas
      .slice(-EMAIL_HISTORY_LIMIT)
      .map((m) => {
        const tag = m.direction === "sent" ? "FBR" : "CLIENTE";
        // Só o que foi escrito de novo: as citações repetiriam a mesma
        // conversa a cada email e enchiam o prompt de ruído pago.
        const corpo = splitQuotedEmail(m.body || m.snippet)
          .visible.slice(0, EMAIL_BODY_CHARS)
          .trim();
        const quando = m.date ? formatDateLisbon(m.date) : "sem data";
        return `[${quando}] ${tag} (assunto: ${m.subject}):
${corpo}`;
      })
      .filter((linha) => linha.trim().length > 0)
      .join("\n\n");
  } catch (err) {
    console.warn("[wa-suggest] falhou a puxar emails (segue sem eles)", err);
    return "";
  }
}

function labelOr(value: string | null, labels: Record<string, string>): string {
  if (!value) return "não preenchido";
  return labels[value] ?? value;
}

// "Extras no quadro": opções escolhidas + texto livre do cliente.
function extrasLine(extras: ExtrasInFrame | null): string {
  if (!extras) return "";
  const partes: string[] = [];
  if (extras.options?.length) partes.push(extras.options.join(", "));
  if (extras.notes?.trim()) partes.push(`nota do cliente: "${extras.notes.trim()}"`);
  return partes.join(" | ");
}

// Ornamentos / pendentes / quadros extra. "Mais info" fica marcado como
// PENDENTE porque é uma pergunta do cliente ainda por responder — é o
// sinal que alimenta requiredContentPoints().
function escolhasExtraLines(o: LinkedOrder): string[] {
  const campos: Array<[string, YesNoInfo | null, number | null]> = [
    ["Quadros extra pequenos", o.extra_small_frames, o.extra_small_frames_qty],
    ["Ornamentos de Natal", o.christmas_ornaments, o.christmas_ornaments_qty],
    ["Pendentes para colares", o.necklace_pendants, o.necklace_pendants_qty],
  ];
  const out: string[] = [];
  for (const [label, valor, qty] of campos) {
    if (!valor) continue;
    const qtyTxt = typeof qty === "number" && qty > 0 ? `, quantidade ${qty}` : "";
    const pendente =
      valor === "mais_info"
        ? " ← PENDENTE: o cliente pediu mais informação sobre isto no formulário"
        : "";
    out.push(`  ${label}: ${YES_NO_INFO_LABELS[valor]}${qtyTxt}${pendente}`);
  }
  return out;
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
  if (o.flower_type) lines.push(`  Tipo de flores (dito pelo cliente): ${o.flower_type}`);
  const extras = extrasLine(o.extras_in_frame);
  if (extras) lines.push(`  Extras no quadro: ${extras}`);
  for (const l of escolhasExtraLines(o)) lines.push(l);
  // Decomposição do orçamento, exactamente como sai nas templates. Sempre
  // que a mensagem falar do que foi encomendado, tem de listar isto todo —
  // o quadro sozinho deixa de fora os ornamentos, pendentes e minis.
  const resumo = resumoEncomendaLinhas(
    { pricing_snapshot: o.pricing_snapshot, frame_size: o.frame_size },
    o.form_language,
    o.budget,
  );
  if (resumo) {
    lines.push(
      "  Orçamento item a item (usar SEMPRE assim quando a mensagem falar do que foi encomendado, nunca só o quadro):",
      ...resumo.split("\n").map((l) => (l ? `    ${l}` : "")),
    );
  }
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
  const conversationIdParam = body?.conversationId?.trim() ?? "";
  const orderIdParam = body?.orderId?.trim() ?? "";
  if (!conversationIdParam && !orderIdParam) {
    return NextResponse.json(
      { error: "conversationId ou orderId em falta" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // 1. Alvo — conversa do WhatsApp ou encomenda ainda sem conversa
  const CONV_COLUMNS = "id, phone_e164, display_phone, contact_name, notes";
  let conv: ConvRow | null = null;
  // Encomenda pedida explicitamente: manda sobre as que se descobrem
  // pelo telefone (é a que ela tem aberta no workbench).
  let orderFromParam: LinkedOrder | null = null;

  if (conversationIdParam) {
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select(CONV_COLUMNS)
      .eq("id", conversationIdParam)
      .single();
    conv = (data as ConvRow | null) ?? null;
    if (!conv) {
      return NextResponse.json({ error: "conversa nao encontrada" }, { status: 404 });
    }
  } else {
    const { data } = await supabase
      .from("orders")
      .select(LINKED_ORDER_COLUMNS)
      .eq("order_id", orderIdParam)
      .is("deleted_at", null)
      .limit(1);
    orderFromParam = ((data ?? [])[0] as LinkedOrder | undefined) ?? null;
    if (!orderFromParam) {
      return NextResponse.json({ error: "encomenda nao encontrada" }, { status: 404 });
    }
    // Pode haver conversa mesmo tendo ela entrado pelo workbench (ex:
    // abriu o painel do WhatsApp na aba errada). Se existir, as
    // mensagens contam — sugerir a ignorá-las seria pior que não sugerir.
    const tail = (orderFromParam.phone ?? "").replace(/\D/g, "").slice(-9);
    if (tail.length === 9) {
      const { data: convData } = await supabase
        .from("whatsapp_conversations")
        .select(CONV_COLUMNS)
        .like("phone_e164", `%${tail}`)
        .limit(1);
      conv = ((convData ?? [])[0] as ConvRow | undefined) ?? null;
    }
  }

  // Conversa efectivamente usada (pode ser null: encomenda sem conversa).
  const conversationId = conv?.id ?? null;

  const { data: msgs } = conversationId
    ? await supabase
        .from("whatsapp_messages")
        .select("direction, content_type, text, received_at")
        .eq("conversation_id", conversationId)
        .order("received_at", { ascending: false })
        .limit(RECENT_MESSAGES_LIMIT)
    : { data: [] };

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
  // Regras destiladas das edições reais da Maria e aprovadas por ela
  // uma a uma no Cérebro do Claude (mig 102). Separadas da persona:
  // a persona é escrita por ela, isto é aprendido do uso.
  const voiceRulesFromDb = (settingsMap.claude_voice_rules ?? "").trim();

  // 3. Encomendas associadas a esta pessoa (por telefone)
  // O matching e por digitos last 9 — espelhada do client side.
  const phoneDigits = (conv?.phone_e164 ?? orderFromParam?.phone ?? "").replace(
    /\D/g,
    "",
  );
  const phoneTail = phoneDigits.slice(-9);
  let linkedOrders: LinkedOrder[] = [];
  if (phoneTail.length === 9) {
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
    linkedOrders = ((allOrders ?? []) as LinkedOrder[]).filter(
      (o) => (o.phone ?? "").replace(/\D/g, "").slice(-9) === phoneTail,
    );
  }
  // A encomenda aberta no workbench vem sempre em primeiro lugar: é
  // sobre ela que a mensagem é, mesmo que a cliente tenha outras.
  if (orderFromParam) {
    const outras = linkedOrders.filter((o) => o.order_id !== orderFromParam!.order_id);
    linkedOrders = [orderFromParam, ...outras];
  }

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

  // Pontos que a mensagem TEM de cobrir (o cliente deixou-os pendentes no
  // formulário). Ao contrário dos templates acima, isto não é uma dica.
  const required = linkedOrders.length
    ? requiredContentPoints(linkedOrders[0])
    : [];
  const requiredBlock = required.length
    ? `\n\n## OBRIGATÓRIO — esta mensagem TEM de cobrir todos estes pontos\n\nO cliente deixou estas questões pendentes no formulário. A mensagem só está correcta se as tratar todas, de forma natural e integrada no texto (não como lista):\n\n${required.map((p) => `- ${p.text}`).join("\n")}`
    : "";

  const notesBlock = conv?.notes ? `\n\nNotas guardadas sobre esta pessoa:\n${conv.notes}` : "";

  // Afinação sobre a versão que ela já tem. Reescrever é diferente de
  // gerar do zero: o que já está bom tem de sobreviver, e só muda o que
  // ela pediu. Sem isto, "quero mais curta" obrigava a refazer tudo e a
  // perder as frases que ela queria manter.
  const refineFrom = body.refineFrom?.trim() ?? "";
  const refineWith = body.refineWith?.trim() ?? "";
  const refinar = Boolean(refineFrom && refineWith);
  const refineBlock = refinar
    ? `
## REESCRITA (é isto que a Maria quer agora)

Ela já tem esta versão e quer mudá-la. NÃO comeces do zero.

<versao_actual>
${refineFrom}
</versao_actual>

Mudança pedida: **${refineWith}**

Aplica só essa mudança. Mantém tudo o resto como está: os factos, valores, datas, links e os pontos obrigatórios acima continuam todos lá. Não acrescentes assuntos novos, não reordenes o que já estava bem, não mudes o tom se não foi isso que ela pediu.
`
    : "";

  // "Refazer" com o prompt igual devolvia a mesma mensagem. Só quando o
  // modelo vê o que já escreveu é que muda de abordagem. Duas versões
  // chegam para o tirar do sítio sem inchar o prompt.
  const jaTentadas = (body.avoid ?? [])
    .map((t) => (t ?? "").trim())
    .filter(Boolean)
    .slice(-2);
  const refazer = !refinar && jaTentadas.length > 0;
  const avoidBlock = refazer
    ? `
## SEGUNDA TENTATIVA — a Maria carregou em "Refazer"

Já escreveste isto e ela não ficou satisfeita:

${jaTentadas.map((t, i) => `<tentativa_${i + 1}>\n${t}\n</tentativa_${i + 1}>`).join("\n\n")}

Escreve uma alternativa **claramente diferente**: outra maneira de abrir, outra ordem das ideias, outras frases, outro comprimento se fizer sentido. Não repitas frases inteiras do que já tentaste.

Muda a FORMA, não o conteúdo: os factos, valores, datas, links e os pontos obrigatórios acima continuam todos lá.
`
    : "";

  // Amostra de voz: mensagens reais da Maria em situações parecidas.
  // A "situação" é o que a cliente escreveu + o estado da encomenda —
  // é isso que faz vir exemplos do assunto certo (pagamentos, atrasos,
  // recolha…) em vez de exemplos ao calhas. Vai no bloco do utilizador
  // (não no system) para não estragar o cache dos templates/persona.
  const situacao = [
    lastReceived.map((m) => m.text ?? "").join(" "),
    body.instruction ?? "",
    linkedOrders[0] ? STATUS_LABELS[linkedOrders[0].status] ?? "" : "",
    required.map((p) => p.text).join(" "),
  ]
    .filter(Boolean)
    .join(" ");
  // Nome da pessoa desta conversa. A encomenda ligada manda (é o nome
  // que ela própria escreveu no formulário); o contacto do WhatsApp é o
  // fallback. Vazio quando não sabemos — e aí ninguém inventa nada.
  const nomeCliente = (
    linkedOrders[0]?.client_name ??
    conv?.contact_name ??
    ""
  ).trim();
  const primeiroNomeCliente = nomeCliente ? nomeCliente.split(/\s+/)[0] : "";

  // Os dois vão à rede: pedem-se ao mesmo tempo para não somar esperas.
  const [voiceExamples, emailHistory] = await Promise.all([
    pickVoiceExamples(supabase, {
      situacao,
      excludeConversationId: conversationId ?? undefined,
    }),
    fetchEmailHistory(linkedOrders[0]?.email),
  ]);
  const voiceBlock = voiceExamplesBlock(voiceExamples, primeiroNomeCliente);
  const emailHistoryBlock = emailHistory
    ? `

## Emails trocados com esta mesma pessoa (outro canal)

O WhatsApp acima não é a história toda: isto foi trocado por email, do mais antigo para o mais recente (citações cortadas). Vale como já dito — não repitas nem contradigas o que aqui está, e se a resposta a dar já foi dada por email, não a voltes a dar como se fosse nova.

${emailHistory}`
    : "";

  // ─── System prompt (cacheable) ───
  // Persona vem de system_settings.claude_persona; se vazio, fallback hardcoded.
  // Factos vem de system_settings.claude_facts; se vazio, omite a seccao.
  const systemPersona = personaFromDb || PERSONA_FALLBACK;
  const systemFacts = factsFromDb
    ? `\n\n## Factos e contexto adicional da FBR (sabe sempre)\n\n${factsFromDb}`
    : "";
  // Regras aprendidas: vêm depois dos factos e antes dos templates, e
  // ganham a qualquer instrução de estilo mais acima — foram tiradas do
  // que a Maria REALMENTE escreve, não do que alguém supôs.
  const systemVoiceRules = voiceRulesFromDb
    ? `\n\n## Regras de voz da Maria (aprendidas das correcções dela — obedece-lhes acima de tudo o resto)\n\n${voiceRulesFromDb}`
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
    claude_voice_rules: "",
    ...settingsMap,
  };
  const paymentBlock =
    settingsMap.payment_iban || settingsMap.payment_mbway
      ? `\n\n## Dados de pagamento reais (usar tal e qual; nunca inventar)\n\nPara clientes portugueses:\n${dadosPagamento("pt", settingsForPayment)}\n\nPara clientes internacionais (MB Way não funciona fora de PT):\n${dadosPagamento("en", settingsForPayment)}${settingsMap.studio_address_url ? `\n\nPonto de encontro / entrega em mãos (link Maps): ${settingsMap.studio_address_url}` : ""}${settingsMap.review_link ? `\nLink de avaliação/opinião: ${settingsMap.review_link}` : ""}`
      : "";

  const templatesAsReference = templates
    .map((t) => `### ${t.name} [${t.language}] (${t.category})\n${t.body}`)
    .join("\n\n---\n\n");

  // Sem uma única mensagem isto não é "responder" — é abrir a conversa.
  // Dizê-lo por palavras evita o erro clássico de o assistente responder
  // a algo que a cliente nunca escreveu.
  const transcriptBlock =
    conversationTranscript ||
    (orderFromParam
      ? "(ainda não há conversa nenhuma: o cliente preencheu o formulário e NUNCA escreveu. Esta é a PRIMEIRA mensagem que lhe enviamos — abre-a como tal, apresenta-te e agradece o pedido; nunca respondas a mensagens que ele não escreveu.)"
      : "(ainda sem mensagens)");

  // Canal: os templates e os exemplos de voz são todos de WhatsApp. Sem
  // isto, o que sai para email é uma mensagem de telemóvel colada num
  // email — sem assunto, sem saudação, sem despedida.
  const porEmail = body.channel === "email";
  const emailBlock = porEmail
    ? `
## CANAL — EMAIL (não é WhatsApp)

Esta mensagem vai por **email**. Escreve-a como email:
- **Primeira linha exactamente \`Assunto: ...\`** (ou \`Subject: ...\` se escreveres em inglês), curto e concreto, seguida de uma linha em branco e só depois o corpo.
- Abre com saudação ao cliente pelo primeiro nome e fecha com despedida e assinatura de quem escreve.
- Parágrafos completos e arejados (nada de linhas soltas de WhatsApp), emojis raros ou nenhuns, sem abreviaturas.
- Os templates da biblioteca são de WhatsApp: aproveita o conteúdo, os valores e as regras, mas passa a forma para email.
`
    : "";

  // Negrito: um marcador só (`**assim**`), convertido pela plataforma
  // para a sintaxe de cada destino. Se o modelo escrevesse asteriscos
  // simples para o email, a Maria tinha de os apagar à mão depois de
  // colar — foi isso que ela pediu para acabar. [[lib/rich-text]]
  const boldBlock = `
## Negrito — o que destacar

Destaca a negrito só o essencial: valores, datas, prazos, códigos (vale-presente, encomenda) e a morada. No máximo **2 ou 3 destaques** por mensagem — se tudo estiver a negrito, nada se destaca. Nunca destaques a saudação, o nome da pessoa, nem frases inteiras.

Escreve o negrito SEMPRE com dois asteriscos, \`**assim**\`, mesmo para o WhatsApp. ${porEmail ? "A plataforma converte isso em negrito a sério quando a Maria copiar o email." : "A plataforma converte isso para a sintaxe do WhatsApp ao copiar."} Nunca escrevas asteriscos simples à volta de palavras.
`;

  const userTask = `## Conversa actual com ${conv?.contact_name ?? conv?.display_phone ?? conv?.phone_e164 ?? nomeCliente ?? "cliente"}

${transcriptBlock}

## Encomendas ligadas a este número

${ordersBlock}${requiredBlock}${suggestionsBlock}${notesBlock}${emailHistoryBlock}${voiceBlock}

## Instrução da Maria

${body.instruction?.trim() ? body.instruction.trim() : "(sem instrução específica — interpreta o contexto e responde como a Maria responderia)"}
${emailBlock}${boldBlock}${refineBlock}${avoidBlock}
## Língua

Responde na língua das últimas mensagens do CLIENTE (não da FBR). Se o cliente escrever em francês, espanhol ou outra língua, responde nessa língua. Se a conversa ainda não permitir perceber, usa: **${probableLang === "en" ? "inglês" : "português europeu"}**.

${refinar ? `Devolve ${porEmail ? "o email reescrito" : "a mensagem reescrita"} (pronto a copiar), e mais nada:` : refazer ? "Escreve a versão alternativa (pronta a copiar), e mais nada:" : porEmail ? "Escreve o email da FBR (assunto na primeira linha, pronto a copiar):" : "Gera a próxima mensagem da FBR (pronta a copiar):"}`;

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
          text: systemPersona + systemFacts + systemVoiceRules + paymentBlock,
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
    // Rede de segurança: se o modelo copiar o marcador {nome} dos
    // exemplos, resolvemo-lo aqui em código. A Maria nunca deve ver um
    // {nome} cru numa mensagem pronta a enviar.
    suggestion = preencherNome(suggestion, primeiroNomeCliente);
    // O modelo às vezes responde em sintaxe de WhatsApp: uniformiza-se
    // aqui para o cliente ter sempre um marcador só com que lidar.
    suggestion = normalizeBold(suggestion);
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
      conversation_id: conversationId,
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
