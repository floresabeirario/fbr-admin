import { describe, it, expect } from "vitest";
import {
  classificarPendencias,
  pendenciasBlock,
  type MensagemFbr,
} from "../whatsapp/pendencias";
import type { RequiredContentPoint } from "../templates";

// Sessão 166: os "Mais info" iam como OBRIGATÓRIO em todas as mensagens.
// Agora cruzam-se com o que a FBR já escreveu.

const pontos: RequiredContentPoint[] = [
  { key: "ornamentos_natal_info", text: "Explicar os ornamentos de Natal." },
  { key: "pendentes_colares_info", text: "Explicar os pendentes para colares." },
  { key: "quadros_extra_info", text: "Explicar os quadros extra pequenos." },
  { key: "opcoes_envio_flores", text: "Apresentar as 3 opções de envio." },
  { key: "morada_recolha", text: "Pedir a morada da recolha." },
];

const m = (text: string, at = "2026-09-10T10:00:00Z"): MensagemFbr => ({ text, at });

describe("classificarPendencias", () => {
  it("sem mensagens nossas: tudo por tratar", () => {
    const r = classificarPendencias(pontos, []);
    expect(r.every((p) => p.tratadaEm === null)).toBe(true);
  });

  it("ornamentos explicados numa mensagem nossa → tratada com a data", () => {
    const r = classificarPendencias(pontos, [
      m("Os ornamentos de Natal são pequenas peças com flores prensadas 🎄"),
    ]);
    expect(r.find((p) => p.key === "ornamentos_natal_info")!.tratadaEm).toBe("10/09/2026");
    expect(r.find((p) => p.key === "pendentes_colares_info")!.tratadaEm).toBeNull();
  });

  it("envio: só 'recolha' não chega; recolha + CTT já apresenta as opções", () => {
    const so = classificarPendencias(pontos, [m("Podemos fazer a recolha no local.")]);
    expect(so.find((p) => p.key === "opcoes_envio_flores")!.tratadaEm).toBeNull();
    const ambas = classificarPendencias(pontos, [
      m("Pode entregar em mãos em Coimbra, enviar por CTT ou pedir a recolha no evento."),
    ]);
    expect(ambas.find((p) => p.key === "opcoes_envio_flores")!.tratadaEm).toBe("10/09/2026");
  });

  it("fica a data da PRIMEIRA mensagem que tratou, mesmo com ordem trocada", () => {
    const r = classificarPendencias(pontos, [
      m("Sobre os pendentes para colar: usamos uma pétala.", "2026-09-12T10:00:00Z"),
      m("Os pendentes ficam lindos 🌸", "2026-09-08T10:00:00Z"),
    ]);
    expect(r.find((p) => p.key === "pendentes_colares_info")!.tratadaEm).toBe("08/09/2026");
  });

  it("mensagens em inglês também contam", () => {
    const r = classificarPendencias(pontos, [
      m("The small frames are 20x25 cm and the pendants use one petal."),
    ]);
    expect(r.find((p) => p.key === "quadros_extra_info")!.tratadaEm).not.toBeNull();
    expect(r.find((p) => p.key === "pendentes_colares_info")!.tratadaEm).not.toBeNull();
  });

  it("'mínimo' não conta como quadro mini", () => {
    const r = classificarPendencias(pontos, [m("O valor mínimo do vale é 300€.")]);
    expect(r.find((p) => p.key === "quadros_extra_info")!.tratadaEm).toBeNull();
  });
});

describe("pendenciasBlock", () => {
  it("vazio sem pendências", () => {
    expect(pendenciasBlock([])).toBe("");
  });

  it("separa por tratar de já tratadas e nunca diz OBRIGATÓRIO", () => {
    const bloco = pendenciasBlock(
      classificarPendencias(pontos, [m("Os ornamentos de Natal são…")]),
    );
    expect(bloco).toContain("Ainda por tratar:");
    expect(bloco).toContain("Explicar os pendentes para colares.");
    expect(bloco).toContain("Já tratadas por nós");
    expect(bloco).toContain("Ornamentos de Natal (explicado a 10/09/2026)");
    expect(bloco).not.toContain("Explicar os ornamentos de Natal.");
    expect(bloco).not.toMatch(/OBRIGATÓRIO/);
  });

  it("só tratadas: não há lista 'por tratar'", () => {
    const bloco = pendenciasBlock(
      classificarPendencias([pontos[0]], [m("ornamentos de natal 🎄")]),
    );
    expect(bloco).not.toContain("Ainda por tratar:");
    expect(bloco).toContain("Já tratadas por nós");
  });
});
