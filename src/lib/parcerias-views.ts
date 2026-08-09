// ============================================================
// Persistência da vista activa das Parcerias
// ============================================================
// Guarda a sub-categoria (Wedding Planners / Floristas / …) e o modo de
// vista (tabela / mapa / comissões) em localStorage, para sobreviver à
// navegação: abrir um parceiro e voltar tem de trazer de volta a MESMA
// sub-aba e vista, não recair sempre em "Wedding Planners / tabela".
//
// Mesmo padrão de snapshot cacheado da preservacao-views: o
// useSyncExternalStore exige referência estável quando nada mudou (senão
// dá React #185), e o servidor usa shape vazio (sem hydration mismatch).

import type { PartnerCategory } from "@/types/partner";

export type ParceriasViewMode = "tabela" | "mapa" | "comissoes";

const CATEGORIES: readonly PartnerCategory[] = [
  "wedding_planners",
  "floristas",
  "quintas_eventos",
  "outros",
];
const VIEW_MODES: readonly ParceriasViewMode[] = ["tabela", "mapa", "comissoes"];

const STORAGE_KEY = "fbr.parcerias.views.v1";

interface Shape {
  activeCategory: PartnerCategory;
  viewMode: ParceriasViewMode;
}

function emptyShape(): Shape {
  return { activeCategory: "wedding_planners", viewMode: "tabela" };
}

function parseStorage(raw: string | null): Shape {
  try {
    if (!raw) return emptyShape();
    const p = JSON.parse(raw) as Partial<Shape>;
    return {
      activeCategory: CATEGORIES.includes(p.activeCategory as PartnerCategory)
        ? (p.activeCategory as PartnerCategory)
        : "wedding_planners",
      viewMode: VIEW_MODES.includes(p.viewMode as ParceriasViewMode)
        ? (p.viewMode as ParceriasViewMode)
        : "tabela",
    };
  } catch {
    return emptyShape();
  }
}

let cacheRaw: string | null | undefined = undefined;
let cacheValue: Shape = emptyShape();
const SERVER_SHAPE: Shape = emptyShape();
const listeners = new Set<() => void>();

export function getParceriasSnapshot(): Shape {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    /* privacy mode — usa default */
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cacheValue = parseStorage(raw);
  }
  return cacheValue;
}

export function getServerParceriasSnapshot(): Shape {
  return SERVER_SHAPE;
}

export function subscribeParcerias(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function updateParceriasStorage(partial: Partial<Shape>): void {
  if (typeof window === "undefined") return;
  const next = { ...getParceriasSnapshot(), ...partial };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / privacy mode — ignorar */
  }
  listeners.forEach((cb) => cb());
}
