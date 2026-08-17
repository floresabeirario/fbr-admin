import { describe, it, expect, beforeEach } from "vitest";
import {
  conversationDrafts,
  currentDraft,
  getComposerSnapshot,
  pushDraft,
  updateDraftText,
  setDraftIndex,
  markDraftUsed,
  saveInstruction,
  clearConversationDrafts,
} from "../whatsapp/composer-drafts";

// Rascunhos persistentes (sessão 153c). Dois problemas reais da Maria:
// perder a mensagem a meio quando o Android mata a PWA (ir ao WhatsApp e
// voltar), e o "Refazer" destruir a sugestão anterior sem volta.

// localStorage mínimo para o ambiente node do vitest.
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => {
      map.clear();
    },
  };
}

const CONV = "conv-1";

beforeEach(() => {
  globalThis.window = {
    localStorage: fakeStorage(),
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as Window & typeof globalThis;
});

function ler(conversationId = CONV) {
  return conversationDrafts(getComposerSnapshot(), conversationId);
}

describe("rascunhos sobrevivem (o problema do Android a matar a PWA)", () => {
  it("o texto escrito fica guardado e lê-se de volta", () => {
    pushDraft(CONV, { original: "Bom dia!", text: "Bom dia!" });
    updateDraftText(CONV, "Bom dia Sofia, tudo bem?");
    // Simula a app a remontar do zero: só o storage sobrevive.
    expect(currentDraft(ler())?.text).toBe("Bom dia Sofia, tudo bem?");
  });

  it("a instrução também sobrevive", () => {
    saveInstruction(CONV, "diz que sim mas só em Setembro");
    expect(ler().instruction).toBe("diz que sim mas só em Setembro");
  });

  it("cada conversa tem o seu rascunho, sem se misturarem", () => {
    pushDraft(CONV, { original: "A", text: "A" });
    pushDraft("conv-2", { original: "B", text: "B" });
    expect(currentDraft(ler(CONV))?.text).toBe("A");
    expect(currentDraft(ler("conv-2"))?.text).toBe("B");
  });
});

describe("histórico de sugestões (o Refazer deixou de destruir)", () => {
  it("cada geração empilha e mostra a nova", () => {
    pushDraft(CONV, { original: "1a", text: "1a" });
    pushDraft(CONV, { original: "2a", text: "2a" });
    const conv = ler();
    expect(conv.drafts).toHaveLength(2);
    expect(conv.index).toBe(1);
    expect(currentDraft(conv)?.text).toBe("2a");
  });

  it("dá para voltar à anterior e ela mantém as edições feitas", () => {
    pushDraft(CONV, { original: "1a", text: "1a" });
    updateDraftText(CONV, "1a corrigida");
    pushDraft(CONV, { original: "2a", text: "2a" });
    setDraftIndex(CONV, 0);
    expect(currentDraft(ler())?.text).toBe("1a corrigida");
  });

  it("editar só mexe no rascunho visível", () => {
    pushDraft(CONV, { original: "1a", text: "1a" });
    pushDraft(CONV, { original: "2a", text: "2a" });
    setDraftIndex(CONV, 0);
    updateDraftText(CONV, "mexi na primeira");
    const drafts = ler().drafts;
    expect(drafts[0].text).toBe("mexi na primeira");
    expect(drafts[1].text).toBe("2a");
  });

  it("o índice nunca sai fora dos limites", () => {
    pushDraft(CONV, { original: "1a", text: "1a" });
    setDraftIndex(CONV, 99);
    expect(ler().index).toBe(0);
    setDraftIndex(CONV, -5);
    expect(ler().index).toBe(0);
  });

  it("guarda no máximo 5 rascunhos, deitando fora o mais antigo", () => {
    for (let i = 1; i <= 7; i++) {
      pushDraft(CONV, { original: `${i}`, text: `${i}` });
    }
    const conv = ler();
    expect(conv.drafts).toHaveLength(5);
    expect(conv.drafts[0].text).toBe("3");
    expect(currentDraft(conv)?.text).toBe("7");
  });
});

describe("marcar como usado (não registar o mesmo par duas vezes)", () => {
  it("marca só o rascunho visível", () => {
    pushDraft(CONV, { original: "1a", text: "1a" });
    pushDraft(CONV, { original: "2a", text: "2a" });
    markDraftUsed(CONV);
    const drafts = ler().drafts;
    expect(drafts[1].used).toBe(true);
    expect(drafts[0].used).toBeUndefined();
  });
});

describe("fechar o composer", () => {
  it("esquece esta conversa e deixa as outras em paz", () => {
    pushDraft(CONV, { original: "A", text: "A" });
    pushDraft("conv-2", { original: "B", text: "B" });
    clearConversationDrafts(CONV);
    expect(ler(CONV).drafts).toHaveLength(0);
    expect(currentDraft(ler("conv-2"))?.text).toBe("B");
  });
});

describe("robustez", () => {
  it("storage corrompido não parte nada", () => {
    window.localStorage.setItem("fbr-wa-composer", "{isto não é json");
    expect(ler().drafts).toEqual([]);
    pushDraft(CONV, { original: "A", text: "A" });
    expect(currentDraft(ler())?.text).toBe("A");
  });

  it("conversa sem rascunhos devolve vazio, não rebenta", () => {
    expect(currentDraft(ler("nunca-vista"))).toBeNull();
  });
});
