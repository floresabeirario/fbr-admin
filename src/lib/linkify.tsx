import React from "react";

// Match URLs http/https (RFC-pragmático): apanha tudo até whitespace ou
// chevron/quote. Pontuação final é "devolvida" depois para não comer o
// "." de uma frase. Não tenta apanhar `www.` ou domínios pelados (ambíguo).
const URL_RE = /\bhttps?:\/\/[^\s<>"]+/gi;

// Pontuação que tipicamente vem depois de uma URL numa frase e não
// faz parte do link em si.
const TRAILING_PUNCT_RE = /[.,;:!?)\]]+$/;

/**
 * Transforma texto plano numa lista de nós React onde URLs http(s) são
 * substituídas por `<a>` clicáveis (target=_blank). Newlines ficam
 * intactos para uso com `whitespace-pre-wrap`. `stopPropagation` no
 * pointerDown garante que clicar num link num card draggable não
 * dispara o drag.
 */
export function linkify(text: string): React.ReactNode {
  if (!text) return text;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  URL_RE.lastIndex = 0;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const raw = match[0];
    const trailingMatch = raw.match(TRAILING_PUNCT_RE);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    const url = trailing ? raw.slice(0, -trailing.length) : raw;
    parts.push(
      <a
        key={`l-${key++}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="text-indigo-600 hover:text-indigo-800 underline break-all"
      >
        {url}
      </a>,
    );
    if (trailing) parts.push(trailing);
    lastIndex = match.index + raw.length;
  }
  if (parts.length === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
