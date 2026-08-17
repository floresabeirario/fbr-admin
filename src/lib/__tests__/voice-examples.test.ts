import { describe, it, expect } from "vitest";
import {
  anonimizar,
  escolherExemplos,
  preencherNome,
  servePorExemplo,
  voiceExamplesBlock,
  type VoiceExample,
} from "../whatsapp/voice-examples";

// Exemplos de voz (sessão 152): mensagens reais da Maria entram no
// prompt como amostra de estilo. A anonimização é a parte crítica —
// os exemplos vêm de conversas com OUTRAS clientes.

describe("anonimizar", () => {
  const nomes = ["Joana Silva", "Sofia", "Ana", "Anabela"];

  it("substitui nomes conhecidos por {nome}", () => {
    expect(anonimizar("Bom dia, Joana! Já recebi as flores.", nomes)).toBe(
      "Bom dia, {nome}! Já recebi as flores.",
    );
  });

  it("apanha o nome independentemente de maiúsculas", () => {
    expect(anonimizar("obrigada SOFIA e sofia", nomes)).toBe(
      "obrigada {nome} e {nome}",
    );
  });

  it("não parte palavras que apenas contêm um nome", () => {
    // "Ana" está dentro de "Anabela" — não pode cortar a meio
    const out = anonimizar("A Anabela falou com a Ana", nomes);
    expect(out).toBe("A {nome} falou com a {nome}");
    expect(out).not.toContain("{nome}bela");
  });

  it("apanha o apelido, não só o primeiro nome", () => {
    expect(anonimizar("falei com a Silva ontem", nomes)).toBe(
      "falei com a {nome} ontem",
    );
  });

  it("não mexe no texto quando não há nomes a redigir", () => {
    const t = "O quadro fica pronto para a semana.";
    expect(anonimizar(t, [])).toBe(t);
  });

  it("ignora fragmentos com menos de 3 letras (evita redacções absurdas)", () => {
    // "Jô" tem 2 letras: não vira token, senão apanhava texto a esmo
    expect(anonimizar("O jo-jo do quadro", ["Jô"])).toBe("O jo-jo do quadro");
  });
});

describe("servePorExemplo", () => {
  const longa =
    "Bom dia! As suas flores chegaram esta manhã e estão já na prensa. " +
    "Vou enviando fotografias ao longo do processo para acompanhar.";

  it("aceita uma mensagem com substância", () => {
    expect(servePorExemplo(longa)).toBe(true);
  });

  it("rejeita confirmações curtas", () => {
    expect(servePorExemplo("Ok, obrigada! 🌷")).toBe(false);
    expect(servePorExemplo("Sim, claro")).toBe(false);
  });

  it("rejeita mensagens que são só emojis", () => {
    expect(servePorExemplo("🌷🌸💐🌺🌻🌹🌷🌸💐🌺🌻🌹🌷🌸💐🌺🌻🌹🌷🌸💐🌺🌻🌹🌷🌸💐🌺🌻🌹")).toBe(
      false,
    );
  });

  it("rejeita mensagens que são essencialmente um link", () => {
    expect(
      servePorExemplo("https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j"),
    ).toBe(false);
  });

  it("rejeita textos enormes (texto colado de outro sítio)", () => {
    expect(servePorExemplo("a".repeat(2000))).toBe(false);
  });
});

describe("escolherExemplos", () => {
  const hoje = new Date().toISOString();
  const antigo = new Date(Date.now() - 400 * 86_400_000).toISOString();

  const exemplos: VoiceExample[] = [
    { text: "Sobre o pagamento do sinal, pode transferir por MB Way.", sentAt: antigo },
    { text: "A recolha das flores no evento fica combinada para as 18h.", sentAt: antigo },
    { text: "O quadro está a ser emoldurado esta semana.", sentAt: antigo },
  ];

  it("prefere o exemplo com palavras em comum com a situação", () => {
    const [primeiro] = escolherExemplos(exemplos, "quando é a recolha das flores?", 1);
    expect(primeiro.text).toContain("recolha");
  });

  it("respeita o limite pedido", () => {
    expect(escolherExemplos(exemplos, "pagamento", 2)).toHaveLength(2);
  });

  it("desempata a favor do mais recente", () => {
    // Sem palavras em comum, decide a recência
    const mistos: VoiceExample[] = [
      { text: "Mensagem antiga sobre molduras e vidros museu.", sentAt: antigo },
      { text: "Mensagem recente sobre molduras e vidros museu.", sentAt: hoje },
    ];
    const [primeiro] = escolherExemplos(mistos, "assunto sem relação nenhuma", 1);
    expect(primeiro.text).toContain("recente");
  });

  it("aguenta lista vazia", () => {
    expect(escolherExemplos([], "seja o que for", 5)).toEqual([]);
  });
});

// Exemplos todos anonimizados ensinavam ao modelo que as mensagens da
// Maria nao levam nome, e ele escrevia sem nome ou copiava o marcador.
// O nome desta conversa entra nos exemplos; e a saida e limpa em codigo.

describe("preencherNome", () => {
  it("substitui o marcador pelo nome da conversa actual", () => {
    expect(preencherNome("Bom dia {nome}, o quadro está pronto.", "Sofia")).toBe(
      "Bom dia Sofia, o quadro está pronto.",
    );
  });

  it("apanha também {nome_completo}", () => {
    expect(preencherNome("Cara {nome_completo},", "Sofia")).toBe("Cara Sofia,");
  });

  it("sem nome, apaga o marcador e a pontuação pendurada", () => {
    expect(preencherNome("Bom dia, {nome}! As flores chegaram.", "")).toBe(
      "Bom dia! As flores chegaram.",
    );
    expect(preencherNome("Olá {nome} 🌷", "")).toBe("Olá 🌷");
  });

  it("nunca deixa um {nome} cru passar para a mensagem final", () => {
    for (const nome of ["Sofia", ""]) {
      expect(preencherNome("Bom dia {nome}, tudo bem?", nome)).not.toContain("{nome}");
    }
  });

  it("não mexe em texto sem marcador", () => {
    const t = "O quadro fica pronto para a semana.";
    expect(preencherNome(t, "Sofia")).toBe(t);
  });
});

describe("voiceExamplesBlock", () => {
  const exemplo: VoiceExample[] = [
    { text: "Bom dia {nome}, o quadro está pronto.", sentAt: new Date().toISOString() },
  ];

  it("devolve vazio quando não há exemplos (assistente funciona à mesma)", () => {
    expect(voiceExamplesBlock([])).toBe("");
  });

  it("instrui a imitar o estilo e não o conteúdo", () => {
    const bloco = voiceExamplesBlock(exemplo);
    expect(bloco).toContain("Imita o estilo, não copies o conteúdo");
    expect(bloco).toContain("Exemplo 1");
  });

  it("com nome conhecido, os exemplos usam-no e o modelo é instruido a tratá-la pelo nome", () => {
    const bloco = voiceExamplesBlock(exemplo, "Sofia");
    expect(bloco).toContain("Bom dia Sofia, o quadro está pronto.");
    expect(bloco).toContain("chama-se **Sofia**");
    expect(bloco).not.toContain("{nome}");
  });

  it("sem nome, manda escrever sem nome e proíbe inventar", () => {
    const bloco = voiceExamplesBlock(exemplo, "");
    expect(bloco).toContain("escreve sem nome");
    expect(bloco).toContain("nem inventes um");
    // O exemplo fica limpo, sem marcador pendurado
    expect(bloco).toContain("Bom dia, o quadro está pronto.");
  });
});
