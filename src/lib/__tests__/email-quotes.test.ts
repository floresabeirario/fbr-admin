import { describe, expect, it } from "vitest";
import { splitQuotedEmail } from "@/lib/email-quotes";

describe("splitQuotedEmail", () => {
  it("devolve tudo quando não há citação", () => {
    const r = splitQuotedEmail("Boa tarde,\n\nfico a aguardar.\n\nAna");
    expect(r.visible).toBe("Boa tarde,\n\nfico a aguardar.\n\nAna");
    expect(r.quoted).toBe("");
  });

  it("corta na atribuição do Gmail em português", () => {
    const r = splitQuotedEmail(
      "Perfeito, obrigada!\n\nEm ter., 2 de set. de 2026 às 10:04, Maria <info@x.pt> escreveu:\n> Boa tarde\n> segue o orçamento",
    );
    expect(r.visible).toBe("Perfeito, obrigada!");
    expect(r.quoted).toContain("segue o orçamento");
  });

  it("corta na atribuição em inglês partida em duas linhas", () => {
    const r = splitQuotedEmail(
      "Thank you!\n\nOn Tue, 2 Sep 2026 at 10:04, Maria <info@x.pt>\nwrote:\n> hello",
    );
    expect(r.visible).toBe("Thank you!");
    expect(r.quoted).toContain("hello");
  });

  it("corta no separador do Outlook", () => {
    const r = splitQuotedEmail("Combinado.\n\n-----Mensagem original-----\nDe: Maria\nAssunto: x");
    expect(r.visible).toBe("Combinado.");
    expect(r.quoted).toContain("Mensagem original");
  });

  it("não corta uma frase que começa por 'Em'", () => {
    const texto = "Em princípio consigo entregar na quinta.\n\nObrigada!";
    expect(splitQuotedEmail(texto).visible).toBe(texto);
  });

  it("não deixa a mensagem vazia quando a resposta vem por baixo da citação", () => {
    const texto = "> Boa tarde\n> segue o orçamento\n\nSim, aceito.";
    const r = splitQuotedEmail(texto);
    expect(r.visible).toBe(texto);
    expect(r.quoted).toBe("");
  });
});
