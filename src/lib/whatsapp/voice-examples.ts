// ============================================================
// Exemplos de voz — mensagens reais da Maria como amostra de estilo
// ============================================================
// O assistente aprendia o tom a partir de uma DESCRIÇÃO escrita à mão
// (system_settings.claude_persona) e dos templates oficiais. Resultado:
// soava a template, não soava à Maria.
//
// Este módulo vai buscar mensagens que a Maria realmente enviou
// (whatsapp_messages.direction = 'sent_echo', o eco que a Meta devolve
// das mensagens escritas no telemóvel) e escolhe as mais parecidas com
// a situação actual, para irem no prompt como exemplos.
//
// Efeito prático: escreve hoje, o assistente aprende hoje. Não há
// treino do modelo nem job nenhum — muda só o que lhe é mostrado.
//
// PRIVACIDADE: os exemplos vêm de conversas com OUTRAS clientes. Antes
// de entrarem no prompt, todos os nomes conhecidos são substituídos por
// {nome}, para o nome da Joana nunca poder aparecer numa sugestão para
// a Sofia. É a parte não-negociável deste ficheiro.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";

// Quantas mensagens enviadas vamos buscar para pontuar. Mais do que
// isto não melhora a escolha e pesa na query.
const CANDIDATE_POOL = 400;

// Limites de tamanho. Abaixo do mínimo são confirmações ("ok", "claro",
// "obrigada 🌷") que não ensinam nada sobre a voz; acima do máximo é
// quase de certeza texto colado de outro sítio.
const MIN_LENGTH = 80;
const MAX_LENGTH = 1200;

// Palavras vazias: não ajudam a distinguir situações, só fazem barulho
// na pontuação.
const STOPWORDS = new Set([
  "a", "à", "ao", "aos", "as", "às", "com", "como", "da", "das", "de", "do",
  "dos", "e", "é", "em", "essa", "esse", "esta", "este", "eu", "isso", "já",
  "lhe", "mas", "me", "mais", "muito", "na", "nas", "não", "no", "nos", "nós",
  "o", "os", "ou", "para", "pela", "pelo", "por", "que", "se", "sem", "ser",
  "seu", "sua", "só", "também", "te", "tem", "um", "uma", "vai", "você",
  "vocês", "nossa", "nosso", "the", "and", "you", "your", "for", "with",
  "that", "this", "have", "will", "are", "was", "our",
]);

export interface VoiceExample {
  text: string;
  /** Quando foi enviada — a UI e os testes usam para mostrar recência */
  sentAt: string;
}

type MessageRow = {
  text: string | null;
  conversation_id: string;
  received_at: string;
};

// ─── Normalização e pontuação ──────────────────────────────

function palavrasSignificativas(texto: string): Set<string> {
  const out = new Set<string>();
  for (const bruto of texto.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (bruto.length < 4) continue;
    if (STOPWORDS.has(bruto)) continue;
    out.add(bruto);
  }
  return out;
}

/**
 * Mensagem serve como exemplo de voz? Filtra o que não ensina estilo:
 * confirmações curtas, só-emoji, e links soltos.
 */
export function servePorExemplo(texto: string): boolean {
  const t = texto.trim();
  if (t.length < MIN_LENGTH || t.length > MAX_LENGTH) return false;

  // Sem emojis e sem pontuação, sobra texto com substância?
  const semEmoji = t.replace(/\p{Extended_Pictographic}/gu, "").trim();
  if (semEmoji.length < MIN_LENGTH) return false;

  // Mensagem que é essencialmente um link (partilha de Drive/Instagram)
  const semLinks = semEmoji.replace(/https?:\/\/\S+/g, "").trim();
  if (semLinks.length < MIN_LENGTH) return false;

  return true;
}

/**
 * Substitui nomes próprios conhecidos por {nome}. `nomes` deve conter
 * nomes completos e/ou primeiros nomes; usamos cada palavra com 3+
 * letras. Comparação sem acentos e sem maiúsculas, para apanhar
 * "Sofia"/"sofia"/"SOFIA".
 */
export function anonimizar(texto: string, nomes: Iterable<string>): string {
  const tokens = new Set<string>();
  for (const nome of nomes) {
    if (!nome) continue;
    for (const parte of nome.trim().split(/\s+/)) {
      const limpo = parte.replace(/[^\p{L}]/gu, "");
      if (limpo.length >= 3) tokens.add(limpo);
    }
  }
  if (tokens.size === 0) return texto;

  // Mais longos primeiro: evita que "Ana" corte o "Ana" de "Anabela"
  // antes de "Anabela" ter hipótese de casar.
  const ordenados = [...tokens].sort((a, b) => b.length - a.length);
  const escapados = ordenados.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  // \p{L} nas fronteiras: em JS o \b não funciona depois de acentuada.
  const re = new RegExp(
    `(?<!\\p{L})(${escapados.join("|")})(?!\\p{L})`,
    "giu",
  );
  return texto.replace(re, "{nome}");
}

// ─── Escolha dos exemplos ──────────────────────────────────

export interface PickVoiceExamplesOptions {
  /** Palavras que descrevem a situação: últimas mensagens do cliente, estado da encomenda */
  situacao: string;
  /** Conversa actual — as mensagens dela já vão no transcript, não repetir */
  excludeConversationId?: string;
  limit?: number;
}

/**
 * Escolhe as mensagens da Maria mais parecidas com a situação actual.
 * Pontuação = palavras em comum com a situação + bónus de recência
 * (mensagens recentes valem mais, para o estilo acompanhar a evolução
 * dela em vez de ficar preso ao que escrevia há um ano).
 */
export function escolherExemplos(
  candidatos: VoiceExample[],
  situacao: string,
  limit: number,
): VoiceExample[] {
  const alvo = palavrasSignificativas(situacao);
  const agora = Date.now();

  const pontuados = candidatos.map((ex) => {
    const palavras = palavrasSignificativas(ex.text);
    let comuns = 0;
    for (const p of palavras) if (alvo.has(p)) comuns++;

    // Recência: 1 no dia, a decair até ~0 ao fim de um ano.
    const dias = Math.max(
      0,
      (agora - new Date(ex.sentAt).getTime()) / 86_400_000,
    );
    const recencia = 1 / (1 + dias / 90);

    return { ex, score: comuns + recencia * 1.5 };
  });

  return pontuados
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((p) => p.ex);
}

/**
 * Puxa da BD as mensagens enviadas pela Maria, filtra, anonimiza e
 * devolve as `limit` mais parecidas com a situação. Falha em silêncio
 * (devolve []) — um exemplo em falta degrada a sugestão, não a parte.
 */
export async function pickVoiceExamples(
  supabase: SupabaseClient,
  { situacao, excludeConversationId, limit = 8 }: PickVoiceExamplesOptions,
): Promise<VoiceExample[]> {
  try {
    const [msgsRes, convsRes] = await Promise.all([
      supabase
        .from("whatsapp_messages")
        .select("text, conversation_id, received_at")
        .eq("direction", "sent_echo")
        .eq("content_type", "text")
        .not("text", "is", null)
        .order("received_at", { ascending: false })
        .limit(CANDIDATE_POOL),
      // Todos os nomes conhecidos — a lista de redacção.
      supabase
        .from("whatsapp_conversations")
        .select("contact_name")
        .not("contact_name", "is", null),
    ]);

    const rows = (msgsRes.data ?? []) as MessageRow[];
    if (rows.length === 0) return [];

    const nomes = ((convsRes.data ?? []) as Array<{ contact_name: string | null }>)
      .map((c) => c.contact_name ?? "")
      .filter(Boolean);

    const candidatos: VoiceExample[] = [];
    for (const r of rows) {
      if (!r.text) continue;
      if (excludeConversationId && r.conversation_id === excludeConversationId) {
        continue;
      }
      if (!servePorExemplo(r.text)) continue;
      candidatos.push({
        text: anonimizar(r.text.trim(), nomes),
        sentAt: r.received_at,
      });
    }

    return escolherExemplos(candidatos, situacao, limit);
  } catch (err) {
    console.warn("[voice-examples] falhou a escolher exemplos", err);
    return [];
  }
}

/** Bloco pronto para o prompt. Vazio se não houver exemplos. */
export function voiceExamplesBlock(exemplos: VoiceExample[]): string {
  if (exemplos.length === 0) return "";
  const corpo = exemplos
    .map((e, i) => `### Exemplo ${i + 1}\n${e.text}`)
    .join("\n\n");
  return `\n\n## Como a Maria escreve mesmo (mensagens reais dela)\n\nEstas são mensagens que a Maria enviou a clientes em situações parecidas. São a referência de VOZ: ritmo das frases, comprimento, uso de emojis, forma de abrir e fechar, expressões dela. Imita o estilo, não copies o conteúdo — os factos vêm da encomenda desta conversa. Os nomes foram substituídos por {nome} de propósito.\n\n${corpo}`;
}
