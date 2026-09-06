import { describe, it, expect } from "vitest";
import {
  intervaloHumano,
  levaSaudacao,
  regraSaudacao,
  transcriptComTempos,
  type TranscriptMessage,
} from "../whatsapp/transcript";
import { lisbonWallClock } from "../format-date";

// Sessão 162: o assistente cumprimentava em todas as respostas porque a
// conversa ia sem horas. A regra passa a ser decidida em código.

const agora = new Date("2026-09-06T14:00:00Z"); // 15:00 em Lisboa (verão)

function msg(minAtras: number, direction: "received" | "sent_echo" = "received"): TranscriptMessage {
  return {
    direction,
    content_type: "text",
    text: "olá",
    received_at: new Date(agora.getTime() - minAtras * 60_000).toISOString(),
  };
}

describe("intervaloHumano", () => {
  it("minutos e horas no mesmo dia", () => {
    expect(intervaloHumano(msg(0).received_at, agora)).toBe("agora mesmo");
    expect(intervaloHumano(msg(2).received_at, agora)).toBe("há 2 min");
    expect(intervaloHumano(msg(3 * 60).received_at, agora)).toBe("há 3 h");
  });

  it("ontem e dias", () => {
    expect(intervaloHumano(msg(20 * 60).received_at, agora)).toBe("ontem");
    expect(intervaloHumano(msg(12 * 24 * 60).received_at, agora)).toBe("há 12 dias");
  });

  it("data inválida devolve vazio", () => {
    expect(intervaloHumano("nada", agora)).toBe("");
  });
});

describe("levaSaudacao", () => {
  it("sem mensagens: sim", () => {
    expect(levaSaudacao([], agora)).toBe(true);
  });

  it("conversa em curso (última mensagem há 2 min): não", () => {
    expect(levaSaudacao([msg(30), msg(2, "sent_echo")], agora)).toBe(false);
  });

  it("última mensagem há mais de 3 h: sim", () => {
    expect(levaSaudacao([msg(4 * 60)], agora)).toBe(true);
  });

  it("última mensagem ontem à noite, mesmo que há menos de 3 h: sim", () => {
    const madrugada = new Date("2026-09-06T00:30:00Z"); // 01:30 Lisboa
    const ontem: TranscriptMessage = {
      direction: "received",
      content_type: "text",
      text: "boa noite",
      received_at: "2026-09-05T22:30:00Z", // 23:30 Lisboa, dia anterior
    };
    expect(levaSaudacao([ontem], madrugada)).toBe(true);
  });
});

describe("regraSaudacao / transcriptComTempos", () => {
  it("escreve a decisão no prompt", () => {
    expect(regraSaudacao([msg(2)], agora)).toMatch(/Saudação: NÃO.*há 2 min/);
    expect(regraSaudacao([], agora)).toMatch(/Saudação: SIM/);
  });

  it("cada linha leva data/hora de Lisboa e distância", () => {
    const linhas = transcriptComTempos([msg(2), msg(0, "sent_echo")], agora).split("\n");
    expect(linhas[0]).toMatch(/^\[06\/09\/2026, 14:58 · há 2 min\] CLIENTE: olá$/);
    expect(linhas[1]).toMatch(/^\[06\/09\/2026, 15:00 · agora mesmo\] FBR: olá$/);
  });

  it("transcript vazio sem mensagens", () => {
    expect(transcriptComTempos([], agora)).toBe("");
  });
});

describe("lisbonWallClock", () => {
  it("getHours devolve a hora de Lisboa, seja qual for o fuso do servidor", () => {
    expect(lisbonWallClock(new Date("2026-09-06T18:30:00Z")).getHours()).toBe(19);
    expect(lisbonWallClock(new Date("2026-01-06T18:30:00Z")).getHours()).toBe(18);
  });
});
