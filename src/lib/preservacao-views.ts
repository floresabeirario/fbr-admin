// ============================================================
// Sistema de "vistas" da tabela Preservação:
//   - colunas opcionais (toggleáveis)
//   - filtros por dimensão
//   - vistas guardáveis (combinação de colunas + filtros)
// Persistência em localStorage (single-user; sem partilha entre dispositivos).
// ============================================================

import type {
  Order,
  HowFoundFBR,
  PaymentStatus,
  EventType,
  CouponStatus,
} from "@/types/database";

// ── Colunas opcionais ────────────────────────────────────────
// Sempre visíveis (não toggleáveis): Cliente, Data evento, Envio, Estado,
// Orçamento, Pagamento.

export const OPTIONAL_COLUMNS = [
  "partner",
  "origem",
  "tipo_evento",
  "nif",
  "telefone",
  "email",
  "comissao",
  "cupao",
] as const;

export type ColumnKey = (typeof OPTIONAL_COLUMNS)[number];

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  partner: "Parceiro",
  origem: "Origem",
  tipo_evento: "Tipo de evento",
  nif: "NIF",
  telefone: "Telefone",
  email: "Email",
  comissao: "Comissão",
  cupao: "Cupão",
};

// Largura sugerida (em pixels para min-width, usada para garantir que a
// tabela cresce em scroll horizontal quando há muitas colunas extra).
export const COLUMN_MIN_PX: Record<ColumnKey, number> = {
  partner: 140,
  origem: 110,
  tipo_evento: 110,
  nif: 110,
  telefone: 120,
  email: 180,
  comissao: 90,
  cupao: 120,
};

// ── Filtros por dimensão ─────────────────────────────────────
// Cada filtro é nullable: null = "qualquer" (não filtrar).
// Valores especiais como "_with" / "_without" cobrem presença/ausência.

export interface FilterConfig {
  partner: "any" | "with" | "without" | { id: string };
  origin: HowFoundFBR | "any" | "missing";
  payment: PaymentStatus | "any";
  eventType: EventType | "any" | "missing";
  couponStatus: CouponStatus | "any";
  nif: "any" | "with" | "without";
}

export const EMPTY_FILTERS: FilterConfig = {
  partner: "any",
  origin: "any",
  payment: "any",
  eventType: "any",
  couponStatus: "any",
  nif: "any",
};

export function countActiveFilters(f: FilterConfig): number {
  let n = 0;
  if (f.partner !== "any") n++;
  if (f.origin !== "any") n++;
  if (f.payment !== "any") n++;
  if (f.eventType !== "any") n++;
  if (f.couponStatus !== "any") n++;
  if (f.nif !== "any") n++;
  return n;
}

export function applyFilters(orders: Order[], f: FilterConfig): Order[] {
  if (countActiveFilters(f) === 0) return orders;
  return orders.filter((o) => {
    if (f.partner === "with" && !o.partner_id) return false;
    if (f.partner === "without" && !!o.partner_id) return false;
    if (typeof f.partner === "object" && o.partner_id !== f.partner.id) return false;

    if (f.origin === "missing" && o.how_found_fbr) return false;
    if (f.origin !== "any" && f.origin !== "missing" && o.how_found_fbr !== f.origin)
      return false;

    if (f.payment !== "any" && o.payment_status !== f.payment) return false;

    if (f.eventType === "missing" && o.event_type) return false;
    if (f.eventType !== "any" && f.eventType !== "missing" && o.event_type !== f.eventType)
      return false;

    if (f.couponStatus !== "any" && o.coupon_status !== f.couponStatus) return false;

    if (f.nif === "with" && !o.nif) return false;
    if (f.nif === "without" && !!o.nif) return false;

    return true;
  });
}

// ── Vistas guardáveis ────────────────────────────────────────

export interface SavedView {
  id: string;
  name: string;
  columns: ColumnKey[];
  filters: FilterConfig;
}

// ── Persistência localStorage ────────────────────────────────

const STORAGE_KEY = "fbr.preservacao.views.v1";

interface StorageShape {
  activeColumns: ColumnKey[];
  filters: FilterConfig;
  views: SavedView[];
  activeViewId: string | null;
}

function emptyShape(): StorageShape {
  return {
    activeColumns: [],
    filters: { ...EMPTY_FILTERS },
    views: [],
    activeViewId: null,
  };
}

function parseStorage(raw: string | null): StorageShape {
  try {
    if (!raw) return emptyShape();
    const parsed = JSON.parse(raw) as Partial<StorageShape>;
    return {
      activeColumns: Array.isArray(parsed.activeColumns)
        ? parsed.activeColumns.filter((c): c is ColumnKey =>
            (OPTIONAL_COLUMNS as readonly string[]).includes(c),
          )
        : [],
      filters: { ...EMPTY_FILTERS, ...(parsed.filters ?? {}) },
      views: Array.isArray(parsed.views) ? parsed.views : [],
      activeViewId: typeof parsed.activeViewId === "string" ? parsed.activeViewId : null,
    };
  } catch {
    return emptyShape();
  }
}

// ── Store reactivo (useSyncExternalStore) ────────────────────
// Snapshot cacheado por valor cru do localStorage — o React exige referência
// estável quando nada mudou (React #185).

let viewsCacheRaw: string | null | undefined = undefined;
let viewsCacheValue: StorageShape = emptyShape();
const SERVER_VIEWS_SHAPE: StorageShape = emptyShape();
const viewsListeners = new Set<() => void>();

export function getViewsSnapshot(): StorageShape {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    /* privacy mode — usa default */
  }
  if (raw !== viewsCacheRaw) {
    viewsCacheRaw = raw;
    viewsCacheValue = parseStorage(raw);
  }
  return viewsCacheValue;
}

export function getServerViewsSnapshot(): StorageShape {
  return SERVER_VIEWS_SHAPE;
}

export function subscribeViews(cb: () => void): () => void {
  viewsListeners.add(cb);
  // "storage" cobre alterações feitas noutra aba.
  window.addEventListener("storage", cb);
  return () => {
    viewsListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function updateViewsStorage(partial: Partial<StorageShape>): void {
  if (typeof window === "undefined") return;
  const next = { ...getViewsSnapshot(), ...partial };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / privacy mode — ignorar */
  }
  viewsListeners.forEach((cb) => cb());
}

// Helper para gerar IDs curtos sem dependência externa.
export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}
