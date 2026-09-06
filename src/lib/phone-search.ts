// ============================================================
// Pesquisa por telemóvel — reconhecer e casar números
// ============================================================
// A pesquisa global comparava o texto tal como vinha. Um número copiado
// do WhatsApp chega como "+351 910 843 885" e na BD pode estar
// "910843885", "+351910843885" ou "351 910 843 885": nunca batia.
// Aqui reduz-se tudo a dígitos e compara-se pelo fim do número (os
// últimos 9 dígitos, o número nacional), que é o que o resto da
// plataforma já faz para ligar conversas a encomendas.
// ============================================================

// Mínimo de dígitos para tratar a pesquisa como um telemóvel. Abaixo
// disto é mais provável ser um código de vale ou parte de um ID.
const MIN_DIGITOS = 6;

// Comprimento do número nacional (PT): o sufixo que se compara.
const TAIL = 9;

/** Só dígitos, sem o prefixo internacional "00". */
export function phoneDigits(raw: string | null | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "");
  return d.startsWith("00") ? d.slice(2) : d;
}

/**
 * Dígitos do número, se a pesquisa PARECER um telemóvel: só dígitos e
 * separadores habituais (+, espaços, hífenes, pontos, parêntesis), com
 * pelo menos MIN_DIGITOS. Senão, null e a pesquisa segue como texto.
 */
export function parsePhoneQuery(query: string): string | null {
  const q = query.trim();
  if (!q) return null;
  if (/[^\d\s+().-]/.test(q)) return null;
  const digits = phoneDigits(q);
  return digits.length >= MIN_DIGITOS ? digits : null;
}

/**
 * O número guardado corresponde ao pesquisado? Com 9+ dígitos compara
 * o fim (último TAIL dígitos), para o indicativo não interferir; com
 * menos (número a meio de ser escrito) basta conter a sequência.
 */
export function phoneMatches(stored: string | null | undefined, queryDigits: string): boolean {
  const s = phoneDigits(stored);
  if (!s || !queryDigits) return false;
  if (queryDigits.length >= TAIL) return s.endsWith(queryDigits.slice(-TAIL));
  return s.includes(queryDigits);
}
