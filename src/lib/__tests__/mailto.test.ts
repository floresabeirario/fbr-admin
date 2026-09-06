import { describe, expect, it } from "vitest";
import { buildMailtoHref, MAILTO_MAX } from "@/lib/mailto";

describe("buildMailtoHref", () => {
  it("preenche destinatário e corpo", () => {
    const href = buildMailtoHref("ana@exemplo.pt", "Boa tarde, Ana!");
    expect(href).toContain("mailto:ana%40exemplo.pt");
    expect(href).toContain("body=Boa+tarde%2C+Ana%21");
  });

  it("separa a linha do assunto quando o texto a traz", () => {
    const href = buildMailtoHref("ana@exemplo.pt", "Assunto: O seu quadro\n\nBoa tarde!");
    expect(href).toContain("subject=O+seu+quadro");
    expect(href).toContain("body=Boa+tarde%21");
  });

  it("tira os marcadores de negrito (o mailto não leva formatação)", () => {
    const href = buildMailtoHref("ana@exemplo.pt", "Sinal de **150€**.");
    expect(href).not.toContain("*");
    expect(href).toContain("150%E2%82%AC");
  });

  it("devolve null sem destinatário válido ou sem texto", () => {
    expect(buildMailtoHref(null, "texto")).toBeNull();
    expect(buildMailtoHref("nao-e-email", "texto")).toBeNull();
    expect(buildMailtoHref("ana@exemplo.pt", "   ")).toBeNull();
  });

  it("devolve null quando o link ficaria grande demais (corpo cortado em silêncio)", () => {
    expect(buildMailtoHref("ana@exemplo.pt", "a".repeat(MAILTO_MAX))).toBeNull();
  });
});
