// ============================================================
// Pesquisa sem acentos nem maiúsculas
// ============================================================
// "joao" tem de encontrar "João" e vice-versa. Antes cada caixa de
// pesquisa fazia `toLowerCase().includes(...)` e o acento separava os
// resultados. Tudo o que é pesquisa de texto passa por aqui: o termo e
// os campos são "dobrados" da mesma maneira antes de se comparar.
// ============================================================

/** Minúsculas, sem acentos/cedilhas (ã→a, ç→c, é→e), espaços nas pontas fora. */
export function foldSearch(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Algum dos campos contém o termo? O termo já deve vir dobrado com
 * `foldSearch` (faz-se uma vez, fora do filtro). Termo vazio = tudo passa.
 */
export function matchesSearch(
  foldedTerm: string,
  ...fields: Array<string | null | undefined>
): boolean {
  if (!foldedTerm) return true;
  return fields.some((f) => foldSearch(f).includes(foldedTerm));
}
