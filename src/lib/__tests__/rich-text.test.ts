import { describe, expect, it } from "vitest";
import { boldForWhatsapp, boldToHtml, normalizeBold, stripBold } from "@/lib/rich-text";

describe("normalizeBold", () => {
  it("mantém o marcador canónico", () => {
    expect(normalizeBold("O sinal é de **150€**.")).toBe("O sinal é de **150€**.");
  });

  it("converte a sintaxe do WhatsApp em marcador canónico", () => {
    expect(normalizeBold("O sinal é de *150€*.")).toBe("O sinal é de **150€**.");
  });

  it("não mexe em asteriscos colados a texto nem em multiplicações", () => {
    expect(normalizeBold("3*4 e a*b")).toBe("3*4 e a*b");
  });
});

describe("boldForWhatsapp", () => {
  it("nunca deixa asteriscos duplos (a chatice de apagar à mão)", () => {
    const saida = boldForWhatsapp("Entrega **em dezembro** e sinal de **150€**.");
    expect(saida).toBe("Entrega *em dezembro* e sinal de *150€*.");
    expect(saida).not.toContain("**");
  });

  it("é idempotente sobre texto já em sintaxe de WhatsApp", () => {
    expect(boldForWhatsapp("sinal de *150€*")).toBe("sinal de *150€*");
  });
});

describe("stripBold", () => {
  it("tira os marcadores todos para o mailto:", () => {
    expect(stripBold("Sinal de **150€** até **12/09**.")).toBe("Sinal de 150€ até 12/09.");
    expect(stripBold("Sinal de *150€*.")).toBe("Sinal de 150€.");
  });
});

describe("boldToHtml", () => {
  it("dá negrito a sério e mantém as quebras de linha", () => {
    expect(boldToHtml("Olá,\nsinal de **150€**.")).toBe("Olá,<br>sinal de <b>150€</b>.");
  });

  it("escapa HTML escrito pelo cliente", () => {
    expect(boldToHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });
});
