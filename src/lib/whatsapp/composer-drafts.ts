// ============================================================
// Rascunhos do composer do WhatsApp (persistentes + histórico)
// ============================================================
// DOIS PROBLEMAS que isto resolve, ambos reportados pela Maria:
//
// 1. "Vou para outra app e volto, e perco o que estava a escrever."
//    O Android/iOS mata a PWA em segundo plano para libertar memória; ao
//    voltar, a app remonta do zero e o estado em memória desapareceu.
//    Ironicamente o botão "Abrir no WhatsApp" agrava isto, porque é
//    precisamente ele que a manda para fora da app. Guardar em
//    localStorage a cada tecla é o que faz a mensagem sobreviver.
//
// 2. "Não dá para ver histórico de sugestões."
//    O "Refazer" substituía a sugestão anterior sem volta. Se a primeira
//    era melhor, perdia-se. Agora cada geração empilha um rascunho e ela
//    navega entre eles.
//
// Guardado por conversa, com tectos apertados: isto é conveniência, não
// arquivo. O registo a sério dos pares vive na BD (mig 102).
// ============================================================

const STORAGE_KEY = "fbr-wa-composer";

// Tectos. localStorage anda pelos 5 MB por origem e é partilhado com o
// resto da app (vistas da Preservação, etc.) — não abusar.
const MAX_DRAFTS_POR_CONVERSA = 5;
const MAX_CONVERSAS = 20;
const MAX_CHARS = 8000;

export interface Draft {
  /** Texto tal como o Claude o gerou (metade do par que alimenta a mig 102) */
  original: string;
  /** Texto actual, com as correcções da Maria */
  text: string;
  /** Já foi copiado/enviado? Evita registar o mesmo par duas vezes */
  used?: boolean;
  language?: string | null;
  at: number;
}

export interface ConversationDrafts {
  instruction: string;
  drafts: Draft[];
  /** Qual dos rascunhos está a ser mostrado */
  index: number;
  updatedAt: number;
}

type StorageShape = Record<string, ConversationDrafts>;

const EMPTY_CONV: ConversationDrafts = {
  instruction: "",
  drafts: [],
  index: 0,
  updatedAt: 0,
};

function emptyShape(): StorageShape {
  return {};
}

function parseStorage(raw: string | null): StorageShape {
  if (!raw) return emptyShape();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return emptyShape();
    }
    return parsed as StorageShape;
  } catch {
    return emptyShape();
  }
}

// ── Store reactivo (useSyncExternalStore) ────────────────────
// Snapshot cacheado pelo valor cru: o React exige referência estável
// quando nada mudou, senão dá React #185 ([[feedback_useSyncExternalStore_pitfall]]).

let cacheRaw: string | null | undefined = undefined;
let cacheValue: StorageShape = emptyShape();
const SERVER_SHAPE: StorageShape = emptyShape();
const listeners = new Set<() => void>();

export function getComposerSnapshot(): StorageShape {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    /* modo privado — usa o default */
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cacheValue = parseStorage(raw);
  }
  return cacheValue;
}

/** Servidor não tem localStorage: shape vazio evita hydration mismatch. */
export function getServerComposerSnapshot(): StorageShape {
  return SERVER_SHAPE;
}

export function subscribeComposer(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function write(next: StorageShape): void {
  // Despeja as conversas mais antigas quando passam do tecto — a Maria
  // trabalha nas de agora, não nas de há duas semanas.
  const ids = Object.keys(next);
  if (ids.length > MAX_CONVERSAS) {
    const ordenadas = ids
      .map((id) => [id, next[id]?.updatedAt ?? 0] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CONVERSAS)
      .map(([id]) => id);
    const podado: StorageShape = {};
    for (const id of ordenadas) podado[id] = next[id];
    next = podado;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / modo privado — o trabalho dela não pode parar por isto */
  }
  listeners.forEach((cb) => cb());
}

function mutate(
  conversationId: string,
  fn: (conv: ConversationDrafts) => ConversationDrafts,
): void {
  if (typeof window === "undefined" || !conversationId) return;
  const all = getComposerSnapshot();
  const atual = all[conversationId] ?? EMPTY_CONV;
  const proximo = fn(atual);
  write({ ...all, [conversationId]: { ...proximo, updatedAt: Date.now() } });
}

// ── Leitura ──────────────────────────────────────────────────

export function conversationDrafts(
  snapshot: StorageShape,
  conversationId: string,
): ConversationDrafts {
  return snapshot[conversationId] ?? EMPTY_CONV;
}

/** Rascunho visível, ou null quando ainda não há nenhum. */
export function currentDraft(conv: ConversationDrafts): Draft | null {
  if (conv.drafts.length === 0) return null;
  const i = Math.min(Math.max(conv.index, 0), conv.drafts.length - 1);
  return conv.drafts[i] ?? null;
}

// ── Escrita ──────────────────────────────────────────────────

export function saveInstruction(conversationId: string, instruction: string): void {
  mutate(conversationId, (c) => ({ ...c, instruction: instruction.slice(0, MAX_CHARS) }));
}

/**
 * Nova geração: empilha e passa a mostrá-la. As mais antigas ficam
 * acessíveis pela navegação até ao tecto; a mais velha cai.
 */
export function pushDraft(
  conversationId: string,
  draft: Omit<Draft, "at">,
): void {
  mutate(conversationId, (c) => {
    const novo: Draft = {
      ...draft,
      original: draft.original.slice(0, MAX_CHARS),
      text: draft.text.slice(0, MAX_CHARS),
      at: Date.now(),
    };
    const drafts = [...c.drafts, novo].slice(-MAX_DRAFTS_POR_CONVERSA);
    return { ...c, drafts, index: drafts.length - 1 };
  });
}

/** Cada tecla que ela escreve. É isto que sobrevive ao Android matar a app. */
export function updateDraftText(conversationId: string, text: string): void {
  mutate(conversationId, (c) => {
    if (c.drafts.length === 0) return c;
    const i = Math.min(Math.max(c.index, 0), c.drafts.length - 1);
    const drafts = c.drafts.map((d, idx) =>
      idx === i ? { ...d, text: text.slice(0, MAX_CHARS) } : d,
    );
    return { ...c, drafts };
  });
}

export function setDraftIndex(conversationId: string, index: number): void {
  mutate(conversationId, (c) => ({
    ...c,
    index: Math.min(Math.max(index, 0), Math.max(c.drafts.length - 1, 0)),
  }));
}

/** Marca o rascunho visível como já registado na BD (não repetir o par). */
export function markDraftUsed(conversationId: string): void {
  mutate(conversationId, (c) => {
    if (c.drafts.length === 0) return c;
    const i = Math.min(Math.max(c.index, 0), c.drafts.length - 1);
    const drafts = c.drafts.map((d, idx) => (idx === i ? { ...d, used: true } : d));
    return { ...c, drafts };
  });
}

/** Fechar o composer (X): esquece tudo o desta conversa. */
export function clearConversationDrafts(conversationId: string): void {
  if (typeof window === "undefined" || !conversationId) return;
  const all = getComposerSnapshot();
  if (!(conversationId in all)) return;
  const proximo = { ...all };
  delete proximo[conversationId];
  write(proximo);
}
