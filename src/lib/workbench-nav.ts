// ============================================================
// FBR Admin — Navegação prev/next entre workbenches
// ============================================================
// Quando se abre um workbench (encomenda, vale ou parceiro), a página
// de listagem grava em sessionStorage a sequência ordenada de IDs/codes
// visíveis no momento do clique. O workbench lê essa sequência e
// renderiza setas prev/next + atalhos de teclado para slidar pela
// ordem da tabela sem voltar à listagem.
//
// Porquê sessionStorage e não URL? A lista pode ter centenas de IDs;
// passar tudo em query string sai caro e polui o link. sessionStorage
// só vive na tab actual e desaparece sozinho quando se fecha — não
// precisamos de cleanup. Se o workbench for aberto directamente (link
// partilhado, refresh sem ter passado pela listagem), a lista simples-
// mente não existe e as setas não aparecem.
// ============================================================

export type WorkbenchNavKey = "orders" | "vouchers" | "partners";

const STORAGE_PREFIX = "fbr:nav:";

function storageKey(key: WorkbenchNavKey): string {
  return STORAGE_PREFIX + key;
}

export function setNavList(key: WorkbenchNavKey, ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(key), JSON.stringify(ids));
  } catch {
    // sessionStorage pode falhar em modo privado / cheio — silencioso.
  }
}

export function getNavList(key: WorkbenchNavKey): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every((v) => typeof v === "string")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface NavContext {
  index: number;
  total: number;
  prev: string | null;
  next: string | null;
}

export function getNavContext(
  key: WorkbenchNavKey,
  currentId: string,
): NavContext | null {
  const list = getNavList(key);
  if (!list || list.length === 0) return null;
  const idx = list.indexOf(currentId);
  if (idx === -1) return null;
  return {
    index: idx,
    total: list.length,
    prev: idx > 0 ? list[idx - 1] : null,
    next: idx < list.length - 1 ? list[idx + 1] : null,
  };
}
