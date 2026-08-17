// ============================================================
// Análise das edições: o que a Maria corrige, virado em regras
// ============================================================
// Lê os pares guardados pela mig 102 (o que o Claude escreveu vs o que
// ela realmente enviou) e pede-lhe que descubra as REGRAS que teriam
// feito a primeira versão já ser a segunda.
//
// Devolve propostas, não altera nada: a Maria aceita ou rejeita uma a
// uma no Cérebro do Claude. As aceites é que vão para
// system_settings.claude_voice_rules e entram no prompt.
//
// Porque é que os pares NÃO editados também vão: sem eles a análise só
// via defeitos e propunha mudar coisas que já estavam boas.
// ============================================================

import { NextResponse } from "next/server";
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

// Pares por análise. Mais do que isto e o prompt fica caro sem propor
// melhores regras — os padrões repetem-se depressa.
const MAX_PARES = 40;
const MAX_TOKENS = 2000;

// Abaixo disto não há padrão nenhum para encontrar, só ruído.
const MINIMO_PARA_ANALISAR = 5;

type Par = {
  id: string;
  instruction: string | null;
  suggestion_original: string;
  suggestion_final: string;
  edited: boolean;
};

const SYSTEM = `És um analista de estilo de escrita. Vais receber pares de mensagens de WhatsApp de um estúdio de preservação de flores: o que um assistente de IA propôs, e o que a Maria (a dona) realmente enviou depois de corrigir.

A tua tarefa: descobrir as REGRAS que teriam feito a primeira versão já ser igual à segunda.

Critérios do que é uma boa regra:
- CONCRETA e accionável ("não uses 'aguardamos'; a Maria escreve 'ficamos a aguardar'"), nunca vaga ("ser mais natural").
- Sobre VOZ e FORMA (vocabulário, comprimento, pontuação, saudações, despedidas, emojis, nível de formalidade), não sobre factos do negócio.
- Deve repetir-se em vários pares. Uma correcção única é contexto, não padrão.
- Se um par NÃO foi editado, é sinal de que aquilo já está bom: não proponhas mudar o que já funciona.

Regras da casa que já são conhecidas e NÃO deves propor outra vez:
- Português europeu.
- Nunca usar travessão (—) nas mensagens; usar vírgula, dois pontos ou parêntesis.

Devolve APENAS um array JSON, sem texto à volta, no formato:
[{"regra": "...", "porque": "...", "exemplos": 3}]

- "regra": a instrução, escrita para ser lida por outro assistente, no imperativo.
- "porque": uma frase curta a explicar o padrão observado, para a Maria decidir.
- "exemplos": em quantos pares observaste isto (número).

No máximo 5 regras, as mais frequentes primeiro. Se não houver padrão claro, devolve [].`;

export async function POST() {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suggestion_edits")
    .select("id, instruction, suggestion_original, suggestion_final, edited")
    .is("analysed_at", null)
    .order("created_at", { ascending: false })
    .limit(MAX_PARES);

  if (error) {
    // Quase de certeza: migração 102 ainda não corrida.
    return NextResponse.json(
      {
        error:
          "Não consegui ler as edições guardadas. A migração 102 já foi corrida no Supabase?",
      },
      { status: 500 },
    );
  }

  const pares = (data ?? []) as Par[];
  if (pares.length < MINIMO_PARA_ANALISAR) {
    return NextResponse.json({
      rules: [],
      analysed: 0,
      message: `Ainda só há ${pares.length} mensagem(ns) por analisar. A partir de ${MINIMO_PARA_ANALISAR} consigo procurar padrões com alguma confiança.`,
    });
  }

  const bloco = pares
    .map((p, i) => {
      const cabecalho = p.edited
        ? `### Par ${i + 1} (a Maria corrigiu)`
        : `### Par ${i + 1} (usou tal e qual — já estava bom)`;
      const instrucao = p.instruction
        ? `\nInstrução que ela deu: ${p.instruction}`
        : "";
      return `${cabecalho}${instrucao}\n\nO ASSISTENTE PROPÔS:\n${p.suggestion_original}\n\nELA ENVIOU:\n${p.suggestion_final}`;
    })
    .join("\n\n---\n\n");

  let rules: unknown = [];
  let usage: ClaudeUsage = {};
  try {
    const anthropic = createAnthropicClient();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `${bloco}\n\nAnalisa estes ${pares.length} pares e devolve o array JSON das regras.`,
        },
      ],
    });
    const first = response.content[0];
    const texto = first?.type === "text" ? first.text : "[]";
    // O modelo às vezes embrulha em ```json — apanha o array na mesma.
    const match = texto.match(/\[[\s\S]*\]/);
    rules = match ? JSON.parse(match[0]) : [];
    usage = response.usage as ClaudeUsage;
  } catch (err) {
    console.error("[voice-rules] anthropic error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "erro na análise" },
      { status: 500 },
    );
  }

  // Marca os pares como analisados: não voltam a pesar nem geram a
  // mesma proposta outra vez. Feito mesmo que ela rejeite as regras —
  // rejeitar é uma decisão, não é "analisar outra vez".
  try {
    const admin = createAdminClient();
    await admin
      .from("suggestion_edits")
      .update({ analysed_at: new Date().toISOString() })
      .in(
        "id",
        pares.map((p) => p.id),
      );
    await admin.from("claude_usage").insert({
      model: CLAUDE_MODEL,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
      cost_usd: calculateClaudeCostUsd(usage),
      caller_email: await getCurrentEmail(),
    });
  } catch (err) {
    console.warn("[voice-rules] pós-processamento falhou", err);
  }

  return NextResponse.json({ rules, analysed: pares.length });
}
