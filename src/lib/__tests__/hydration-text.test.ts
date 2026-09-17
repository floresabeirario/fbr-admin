import { describe, it, expect } from "vitest";
import { hydrationSafeText, hydrationSafeDeep } from "@/lib/hydration-text";

// O browser converte CR em LF e come os controlos C0 ao ler o HTML do
// servidor. Se o texto que fica na árvore do React ainda tiver esses
// caracteres, a hidratação rebenta (#418). Estes testes fixam a
// normalização que impede isso.
describe("hydrationSafeText", () => {
  it("converte CRLF e CR solto em LF", () => {
    expect(hydrationSafeText("olá\r\nboa tarde")).toBe("olá\nboa tarde");
    expect(hydrationSafeText("olá\rboa tarde")).toBe("olá\nboa tarde");
  });

  it("deita fora controlos C0 mas preserva tab e newline", () => {
    expect(hydrationSafeText("a\u0000b\u0007c")).toBe("abc");
    expect(hydrationSafeText("a\tb\nc")).toBe("a\tb\nc");
  });

  it("devolve a MESMA referência quando não há nada a mudar", () => {
    const s = "mensagem normal com emoji 🌸 e acentos";
    expect(hydrationSafeText(s)).toBe(s);
  });

  it("deixa passar null e undefined", () => {
    expect(hydrationSafeText(null)).toBeNull();
    expect(hydrationSafeText(undefined)).toBeUndefined();
  });
});

describe("hydrationSafeDeep", () => {
  it("normaliza strings dentro de linhas da BD, incluindo JSONB", () => {
    const linha = {
      id: "1",
      last_message_preview: "boa noite\r\nobrigada",
      unread_count: 2,
      archived: false,
      contact_name: null,
      extras: { nota: "com\rCR", lista: ["a\r\nb", "c"] },
    };
    const saida = hydrationSafeDeep(linha);
    expect(saida.last_message_preview).toBe("boa noite\nobrigada");
    expect(saida.extras.nota).toBe("com\nCR");
    expect(saida.extras.lista).toEqual(["a\nb", "c"]);
    expect(saida.unread_count).toBe(2);
    expect(saida.archived).toBe(false);
    expect(saida.contact_name).toBeNull();
  });

  it("não clona nada quando já está tudo limpo (barato em listas grandes)", () => {
    const linhas = [{ id: "1", texto: "tudo bem" }, { id: "2", texto: "sim" }];
    expect(hydrationSafeDeep(linhas)).toBe(linhas);
  });

  it("clona só o que muda", () => {
    const limpa = { id: "1", texto: "tudo bem" };
    const suja = { id: "2", texto: "com\rCR" };
    const entrada = [limpa, suja];
    const saida = hydrationSafeDeep(entrada);
    expect(saida).not.toBe(entrada);
    expect(saida[0]).toBe(limpa);
    expect(saida[1]).not.toBe(suja);
    expect(saida[1].texto).toBe("com\nCR");
  });
});
