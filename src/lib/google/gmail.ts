import "server-only";
import { google, type gmail_v1 } from "googleapis";
import { getAuthenticatedClient, loadIntegration } from "./oauth";

/**
 * Leitura (read-only) dos emails trocados com um cliente na conta
 * info@floresabeirario.pt.
 *
 * Filosofia igual ao WhatsApp: SÓ leitura. A plataforma mostra o histórico
 * para a Maria ter contexto; o envio continua a ser feito à mão no Gmail
 * (memória "nada de envio automático").
 *
 * O scope necessário (`gmail.readonly`) já está em GOOGLE_SCOPES desde o
 * alicerce OAuth. Se a ligação guardada foi feita antes de o scope ser
 * concedido, `gmailScopeGranted()` devolve false e o painel pede reconexão.
 */

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

// Quantas threads puxar no máximo (mais que isto é raro com um cliente e
// desperdiça quota da API).
const MAX_THREADS = 15;

export type GmailMessage = {
  id: string;
  /** "FBR" quando a mensagem foi enviada pela conta info@; "Cliente" caso contrário. */
  direction: "sent" | "received";
  from: string;
  to: string;
  date: string | null; // ISO; null se o header faltar
  snippet: string;
  /** Corpo em texto simples (best-effort; pode estar vazio em emails só-HTML). */
  body: string;
};

export type GmailThread = {
  id: string;
  subject: string;
  messages: GmailMessage[];
  /** Data da mensagem mais recente da thread (ISO) para ordenação. */
  lastDate: string | null;
};

export type GmailFetchResult =
  | { status: "ok"; account: string; threads: GmailThread[] }
  | { status: "not_connected" }
  | { status: "missing_scope"; account: string | null };

/** A integração já tem o scope de leitura do Gmail concedido? */
export async function gmailScopeGranted(): Promise<boolean> {
  const integration = await loadIntegration();
  if (!integration?.refresh_token) return false;
  return (integration.scopes ?? []).includes(GMAIL_READONLY_SCOPE);
}

async function getGmail(): Promise<gmail_v1.Gmail> {
  const auth = await getAuthenticatedClient();
  return google.gmail({ version: "v1", auth });
}

function headerValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  const lower = name.toLowerCase();
  const h = (headers ?? []).find((x) => (x.name ?? "").toLowerCase() === lower);
  return h?.value ?? "";
}

/** Extrai o endereço puro de um header tipo `"Maria <maria@x.pt>"`. */
function extractEmail(headerVal: string): string {
  const match = headerVal.match(/<([^>]+)>/);
  return (match ? match[1] : headerVal).trim().toLowerCase();
}

/** Descodifica o corpo base64url do Gmail, percorrendo as partes MIME. */
function extractPlainBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  function decode(data: string | null | undefined): string {
    if (!data) return "";
    return Buffer.from(data, "base64url").toString("utf-8");
  }

  // Caso simples: corpo directo.
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decode(payload.body.data);
  }

  // Multipart: procurar primeiro text/plain; cair para text/html sem tags.
  const parts = payload.parts ?? [];
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return decode(part.body.data);
    }
    // Recursão para multipart/alternative aninhado.
    if (part.parts?.length) {
      const nested = extractPlainBody(part);
      if (nested) return nested;
    }
  }
  for (const part of parts) {
    if (part.mimeType === "text/html" && part.body?.data) {
      return decode(part.body.data)
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
  }
  return "";
}

/**
 * Devolve as threads de email trocadas com `clientEmail`, da mais recente
 * para a mais antiga. Cada thread inclui as suas mensagens com direcção,
 * participantes, data, snippet e corpo em texto.
 */
export async function fetchThreadsWithContact(
  clientEmail: string | null | undefined,
): Promise<GmailFetchResult> {
  const integration = await loadIntegration();
  if (!integration?.refresh_token) {
    return { status: "not_connected" };
  }
  if (!(integration.scopes ?? []).includes(GMAIL_READONLY_SCOPE)) {
    return { status: "missing_scope", account: integration.google_email };
  }

  const email = (clientEmail ?? "").trim().toLowerCase();
  const account = integration.google_email ?? "info@floresabeirario.pt";
  if (!email || !email.includes("@")) {
    return { status: "ok", account, threads: [] };
  }

  const gmail = await getGmail();

  // 1. Listar threads que incluem o email do cliente (enviado OU recebido).
  const listRes = await gmail.users.threads.list({
    userId: "me",
    q: `from:${email} OR to:${email}`,
    maxResults: MAX_THREADS,
  });
  const threadStubs = listRes.data.threads ?? [];

  // 2. Para cada thread, puxar mensagens (formato full para ter o corpo).
  const threads: GmailThread[] = [];
  for (const stub of threadStubs) {
    if (!stub.id) continue;
    const threadRes = await gmail.users.threads.get({
      userId: "me",
      id: stub.id,
      format: "full",
    });
    const rawMessages = threadRes.data.messages ?? [];
    let subject = "";
    const messages: GmailMessage[] = rawMessages.map((m) => {
      const headers = m.payload?.headers;
      const from = headerValue(headers, "From");
      const to = headerValue(headers, "To");
      const subj = headerValue(headers, "Subject");
      if (!subject && subj) subject = subj;
      const dateHeader = headerValue(headers, "Date");
      const parsedDate = dateHeader ? new Date(dateHeader) : null;
      const dateIso =
        parsedDate && !Number.isNaN(parsedDate.getTime())
          ? parsedDate.toISOString()
          : m.internalDate
            ? new Date(Number(m.internalDate)).toISOString()
            : null;
      const fromEmail = extractEmail(from);
      const direction: "sent" | "received" =
        fromEmail === account.toLowerCase() ? "sent" : "received";
      return {
        id: m.id ?? "",
        direction,
        from,
        to,
        date: dateIso,
        snippet: m.snippet ?? "",
        body: extractPlainBody(m.payload),
      };
    });

    const lastDate =
      messages.reduce<string | null>((acc, m) => {
        if (!m.date) return acc;
        if (!acc || m.date > acc) return m.date;
        return acc;
      }, null) ?? null;

    threads.push({
      id: stub.id,
      subject: subject || "(sem assunto)",
      messages,
      lastDate,
    });
  }

  // 3. Ordenar threads da mais recente para a mais antiga.
  threads.sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""));

  return { status: "ok", account, threads };
}
