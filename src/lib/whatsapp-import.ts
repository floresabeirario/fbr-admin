// ============================================================
// Parser para o formato exportado pelo WhatsApp
// ============================================================
// O WhatsApp Web → "Exportar conversa" → "Sem multimédia" devolve
// um .txt com este formato (português):
//
//   27/04/26, 11:31 - As mensagens e as chamadas são encriptadas...
//   27/04/26, 11:31 - Flores à Beira Rio: Dear Carla 🌸
//   27/04/26, 12:25 - Carla Santos: Ah these are amazing news!
//   27/04/26, 12:43 - Carla Santos: Ja mandei😊 so vou ter accesso...
//   27/04/26, 12:43 - Carla Santos: Podemos communicar em português😊
//
// Mensagens multi-linha não repetem o timestamp — o texto da
// continuação aparece numa linha sem o prefixo "dd/MM/yy, HH:mm - ".
// O parser tem de detectar essas continuações.
//
// Marcadores filtrados:
//   - "As mensagens e as chamadas são encriptadas" (system)
//   - "<Ficheiro não revelado>" (anexos sem multimédia)
//   - "<Esta mensagem foi editada>" / "Eliminou esta mensagem"
//   - "Afixou uma mensagem"
//   - Mensagens vazias
//
// Detecção de direcção:
//   "sent"     = nome === ourName (default "Flores à Beira Rio")
//   "received" = qualquer outro nome (cliente)
// ============================================================

import type { WhatsAppEntry, WhatsAppDirection } from "@/types/whatsapp";

// Regex captura: "dd/MM/yy, HH:mm - Nome: corpo"
// Notas:
//   - O ano pode ser 2 ou 4 dígitos. Em PT é sempre 2 ("27/04/26").
//   - O nome pode conter espaços, +, números (números desconhecidos).
//   - O nome não tem ":" (excepto se for tipo "Carla: Santos", improvável).
//   - As mensagens de sistema NÃO têm ":" no campo de nome (ex: "27/04/26, 11:31 - As mensagens..." sem ":").
const LINE_RE = /^(\d{2}\/\d{2}\/\d{2,4}),\s+(\d{2}:\d{2})\s+-\s+(.*)$/;

const DEFAULT_OUR_NAME = "Flores à Beira Rio";

// Frases que indicam mensagens de sistema (não devem ser registadas).
const SYSTEM_PATTERNS: RegExp[] = [
  /As mensagens e as chamadas são encriptadas/i,
  /Afixou uma mensagem/i,
  /Removeu uma mensagem afixada/i,
  /é um contacto/i,
  /^Eliminou esta mensagem$/i,
  /^Esta mensagem foi eliminada$/i,
  /criou o grupo/i,
  /adicionou o seu contacto/i,
  /adicionou o contacto/i,
];

// Marcadores que removemos do corpo mas não invalidam a mensagem.
const STRIP_MARKERS: RegExp[] = [
  /\s*<Esta mensagem foi editada>\s*/g,
  /\s*<Ficheiro não revelado>\s*/g,
];

interface ParsedHeader {
  timestamp: string;     // ISO
  authorOrSystem: string; // tudo a seguir ao "- ", até "\n" — pode ter ":" ou não
}

/** Converte "27/04/26" + "11:31" para ISO datetime. Assume timezone local. */
function buildIso(date: string, time: string): string | null {
  const dateParts = date.split("/");
  if (dateParts.length !== 3) return null;
  const [dd, mm, yyRaw] = dateParts;
  const year = yyRaw.length === 2 ? 2000 + Number(yyRaw) : Number(yyRaw);
  const [hh, mi] = time.split(":");
  const d = new Date(year, Number(mm) - 1, Number(dd), Number(hh), Number(mi), 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function tryParseHeader(line: string): ParsedHeader | null {
  const m = line.match(LINE_RE);
  if (!m) return null;
  const iso = buildIso(m[1], m[2]);
  if (!iso) return null;
  return { timestamp: iso, authorOrSystem: m[3] };
}

function isSystemMessage(body: string): boolean {
  return SYSTEM_PATTERNS.some((p) => p.test(body));
}

function cleanContent(raw: string): string {
  let out = raw;
  for (const re of STRIP_MARKERS) {
    out = out.replace(re, "");
  }
  return out.trim();
}

// UUID v4 simples (não criptograficamente forte, basta para chave única local).
function uuidLite(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface ParseResult {
  entries: WhatsAppEntry[];
  /** Nº de mensagens system filtradas (info para a UI mostrar à Maria). */
  systemFiltered: number;
  /** Nº de linhas que não bateram com o padrão (sinal de export estranho). */
  unparsedLines: number;
}

/**
 * Faz parse de um export WhatsApp completo. Reúne linhas de continuação.
 * `ourName` permite distinguir mensagens enviadas (nossas) das recebidas.
 *
 * Devolve as entradas por ordem cronológica (já estão no ficheiro). Não
 * gera duplicados — se chamares 2× com o mesmo input, recebes 2× as
 * mesmas entradas com IDs diferentes (são pesos diferentes na BD).
 */
export function parseWhatsAppExport(
  rawText: string,
  ourName: string = DEFAULT_OUR_NAME,
): ParseResult {
  const lines = rawText.replace(/\r/g, "").split("\n");

  const entries: WhatsAppEntry[] = [];
  let systemFiltered = 0;
  let unparsedLines = 0;

  // Estado: a entrada actual sendo construída. Linhas de continuação são
  // appended ao `content` desta.
  let current: WhatsAppEntry | null = null;
  let currentIsSystem = false;

  function flush() {
    if (!current) return;
    if (currentIsSystem) {
      systemFiltered++;
      current = null;
      currentIsSystem = false;
      return;
    }
    const cleaned = cleanContent(current.content);
    if (cleaned.length > 0) {
      entries.push({ ...current, content: cleaned });
    }
    current = null;
    currentIsSystem = false;
  }

  for (const line of lines) {
    if (line.length === 0) continue;

    const header = tryParseHeader(line);
    if (header) {
      // Fecha a anterior antes de começar nova.
      flush();

      // Pode ser system ("As mensagens são encriptadas...") ou mensagem
      // de utilizador ("Nome: conteúdo").
      const colonIdx = header.authorOrSystem.indexOf(":");
      if (colonIdx === -1) {
        // Não tem ":", é system. (Ou nome sem mensagem — raro.)
        if (isSystemMessage(header.authorOrSystem)) {
          systemFiltered++;
        } else {
          unparsedLines++;
        }
        continue;
      }

      const author = header.authorOrSystem.slice(0, colonIdx).trim();
      const body = header.authorOrSystem.slice(colonIdx + 1).trim();

      // Mensagens "system" geralmente não têm ":" mas há padrões mistos
      // (ex: "<Nome> criou o grupo \"X\""). Filtra também aqui.
      if (isSystemMessage(`${author}: ${body}`)) {
        systemFiltered++;
        continue;
      }

      const direction: WhatsAppDirection = author === ourName ? "sent" : "received";

      current = {
        id: uuidLite(),
        timestamp: header.timestamp,
        direction,
        content: body,
      };
      currentIsSystem = false;
    } else {
      // Linha de continuação da mensagem anterior.
      if (current) {
        current.content += `\n${line}`;
      } else {
        unparsedLines++;
      }
    }
  }
  flush();

  return { entries, systemFiltered, unparsedLines };
}
