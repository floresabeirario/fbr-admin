// ============================================================
// Construir o `mailto:` dos botões "Abrir no email"
// ============================================================
// Partilhado pelo assistente (sugestões) e pelo picker de templates, para
// as duas regras não divergirem: assunto separado do corpo, marcadores de
// negrito removidos (o mailto: não leva formatação) e um tecto de
// comprimento — acima dele há clientes de email que cortam o corpo em
// silêncio, e uma mensagem truncada a meio é pior do que não ter o botão.
// ============================================================

import { splitAssunto } from "@/lib/email-subject";
import { stripBold } from "@/lib/rich-text";

/** Tecto conservador do `mailto:`. Acima disto devolve-se null. */
export const MAILTO_MAX = 1900;

/**
 * Devolve o href pronto a usar, ou null quando não há destinatário
 * válido, não há texto, ou o link ficaria grande demais.
 */
export function buildMailtoHref(
  email: string | null | undefined,
  texto: string | null | undefined,
): string | null {
  const destinatario = (email ?? "").trim();
  const corpoBruto = (texto ?? "").trim();
  if (!destinatario.includes("@") || !corpoBruto) return null;

  const { subject, body } = splitAssunto(corpoBruto);
  const params = new URLSearchParams();
  if (subject) params.set("subject", stripBold(subject));
  params.set("body", stripBold(body));

  const href = `mailto:${encodeURIComponent(destinatario)}?${params.toString()}`;
  return href.length > MAILTO_MAX ? null : href;
}
