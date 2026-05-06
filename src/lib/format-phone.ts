/**
 * Formata um número de telefone com indicativo + grupos legíveis.
 *
 * - Para nº PT (9 dígitos a começar por 9 ou indicativo "351"): "+351 9XX XXX XXX"
 * - Para outros indicativos comuns (1, 33, 34, 39, 44, 49, 55…): tenta separar
 *   indicativo (1-3 dígitos) + grupos de 3.
 * - Quando não há indicativo discernível, agrupa em blocos de 3 a partir da esquerda.
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  // PT sem indicativo (9 dígitos a começar por 2/9)
  if (digits.length === 9 && /^[29]/.test(digits)) {
    return `+351 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  // PT com indicativo
  if (digits.startsWith("351") && digits.length === 12) {
    const rest = digits.slice(3);
    return `+351 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }

  // Indicativos comuns (1=US, 33=FR, 34=ES, 39=IT, 44=UK, 49=DE, 55=BR…)
  const COMMON_CC = ["1", "7", "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48", "49", "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81", "82", "84", "86", "90", "91", "92", "93", "94", "95", "98"];
  for (const cc of COMMON_CC.sort((a, b) => b.length - a.length)) {
    if (digits.startsWith(cc) && digits.length > cc.length + 6) {
      const rest = digits.slice(cc.length);
      return `+${cc} ${groupBy3(rest)}`;
    }
  }

  // Sem indicativo claro: agrupa em blocos de 3
  return `+${groupBy3(digits)}`;
}

function groupBy3(s: string): string {
  return s.replace(/(\d{3})(?=\d)/g, "$1 ");
}

/** Versão "limpa" para construir o link wa.me — só dígitos, sem +. */
export function phoneToWaMe(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}
