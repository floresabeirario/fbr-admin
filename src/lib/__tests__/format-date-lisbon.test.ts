// Estes testes existem para provar uma coisa só: que o texto de datas e
// horas é IGUAL no servidor e no browser. O servidor Vercel corre em UTC
// e o browser da Maria em Europe/Lisbon; quando os dois discordam, o React
// deita a árvore fora ao hidratar (erro #418) e o healthcheck fica vermelho.
//
// Por isso o preflight corre este ficheiro nos DOIS fusos:
//   TZ=UTC vitest run  ·  TZ=Europe/Lisbon vitest run
// Se um valor dependesse do fuso da máquina, uma das corridas falhava.
//
// O instante escolhido (26/08/2026 23:41 UTC) é o pior caso real: em
// Lisboa (UTC+1 no verão) já é dia 27, em UTC ainda é dia 26.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  calendarDaysFromTodayLisbon,
  formatDateLisbon,
  formatDayMonthLisbon,
  formatTimeLisbon,
  lisbonDayKey,
  relativeMonthsDays,
} from "../format-date";

const MEIA_NOITE_LISBOA = new Date("2026-08-26T23:41:00Z");

describe("datas fixas na hora de Lisboa (SSR ↔ browser)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MEIA_NOITE_LISBOA);
  });
  afterEach(() => vi.useRealTimers());

  it("o dia do calendário é o de Lisboa, não o da máquina", () => {
    expect(lisbonDayKey(MEIA_NOITE_LISBOA)).toBe("2026-08-27");
    expect(lisbonDayKey(new Date("2026-08-26T22:03:00Z"))).toBe("2026-08-26");
    // Inverno: Lisboa = UTC, o dia não desliza.
    expect(lisbonDayKey(new Date("2026-01-15T23:41:00Z"))).toBe("2026-01-15");
  });

  it("a hora das mensagens é a de Portugal", () => {
    expect(formatTimeLisbon("2026-08-26T22:03:00Z")).toBe("23:03");
    expect(formatTimeLisbon("2026-01-15T22:03:00Z")).toBe("22:03");
  });

  it("a data de um instante usa o dia de Lisboa", () => {
    expect(formatDateLisbon("2026-08-26T23:41:00Z")).toBe("27/08/2026");
    expect(formatDayMonthLisbon("2026-08-26T23:41:00Z")).toBe("27/08");
  });

  it("conta dias de calendário a partir de hoje em Lisboa", () => {
    // Já é dia 27 em Lisboa, mesmo com o relógio UTC no dia 26.
    expect(calendarDaysFromTodayLisbon("2026-08-27")).toBe(0);
    expect(calendarDaysFromTodayLisbon("2026-08-28")).toBe(1);
    expect(calendarDaysFromTodayLisbon("2026-08-26")).toBe(-1);
    expect(calendarDaysFromTodayLisbon("2026-09-15")).toBe(19);
  });

  it("os relativos do workbench seguem o mesmo calendário", () => {
    expect(relativeMonthsDays("2026-08-27")).toBe("Hoje");
    expect(relativeMonthsDays("2026-08-28")).toBe("Amanhã");
    expect(relativeMonthsDays("2026-08-26")).toBe("Ontem");
  });
});
