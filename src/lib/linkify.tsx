import React from "react";

// Match URLs http/https (RFC-pragmático): apanha tudo até whitespace ou
// chevron/quote. Pontuação final é "devolvida" depois para não comer o
// "." de uma frase. Não tenta apanhar `www.` ou domínios pelados (ambíguo).
const URL_RE = /\bhttps?:\/\/[^\s<>"]+/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Telefone com indicativo internacional: +351 935 896 353 / +1 (662) 310 7949 / etc.
// E PT pelado 9 digitos a comecar por 9: 935 896 353
const PHONE_RE = /(?:\+\d{1,3}\s?(?:\(\d+\)\s?)?[\d\s.-]{6,}|\b9\d[\s.-]?\d{3}[\s.-]?\d{3}\b)/g;

// Pontuação que tipicamente vem depois de uma URL numa frase e não
// faz parte do link em si.
const TRAILING_PUNCT_RE = /[.,;:!?)\]]+$/;

type Token = {
  start: number;
  end: number;
  href: string;
  display: string;
};

function collectMatches(text: string, re: RegExp, hrefBuilder: (m: string) => string | null): Token[] {
  const out: Token[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0];
    const trailingMatch = raw.match(TRAILING_PUNCT_RE);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    const display = trailing ? raw.slice(0, -trailing.length) : raw;
    const href = hrefBuilder(display);
    if (!href) continue;
    out.push({ start: m.index, end: m.index + display.length, href, display });
  }
  return out;
}

/**
 * Transforma texto plano numa lista de nós React onde URLs, emails e
 * telefones são substituídos por `<a>` clicáveis. Newlines ficam intactos
 * para uso com `whitespace-pre-wrap`.
 */
export function linkify(text: string): React.ReactNode {
  if (!text) return text;

  const tokens: Token[] = [
    ...collectMatches(text, URL_RE, (s) => s),
    ...collectMatches(text, EMAIL_RE, (s) => `mailto:${s}`),
    ...collectMatches(text, PHONE_RE, (s) => {
      const digits = s.replace(/\D/g, "");
      if (digits.length < 8) return null; // ignorar muito curtos
      return `tel:+${digits}`;
    }),
  ].sort((a, b) => a.start - b.start);

  // Remover sobreposicoes (manter o primeiro de cada conflito)
  const filtered: Token[] = [];
  let cursor = 0;
  for (const t of tokens) {
    if (t.start < cursor) continue;
    filtered.push(t);
    cursor = t.end;
  }

  if (filtered.length === 0) return text;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const t of filtered) {
    if (t.start > lastIndex) parts.push(text.slice(lastIndex, t.start));
    parts.push(
      <a
        key={`l-${key++}`}
        href={t.href}
        target={t.href.startsWith("http") ? "_blank" : undefined}
        rel={t.href.startsWith("http") ? "noopener noreferrer" : undefined}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="text-indigo-600 hover:text-indigo-800 underline break-all"
      >
        {t.display}
      </a>,
    );
    lastIndex = t.end;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
