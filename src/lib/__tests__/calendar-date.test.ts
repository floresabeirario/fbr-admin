import { describe, it, expect } from "vitest";
import {
  effectiveCalendarDate,
  calendarDateBecomesAvailable,
  type CalendarDateFields,
} from "@/lib/google/calendar-date";

// Base: preservação típica (tem data do evento, ainda sem entrega marcada).
const base: CalendarDateFields = {
  event_date: "2026-09-12",
  flower_delivery_method: null,
  pickup_date: null,
  hand_delivery_date: null,
};

describe("effectiveCalendarDate", () => {
  it("usa a data do evento quando não há entrega marcada", () => {
    expect(effectiveCalendarDate(base)).toBe("2026-09-12");
  });

  it("recolha no local manda sobre a data do evento", () => {
    expect(
      effectiveCalendarDate({
        ...base,
        flower_delivery_method: "recolha_evento",
        pickup_date: "2026-09-13",
      }),
    ).toBe("2026-09-13");
  });

  it("entrega em mãos manda sobre a data do evento", () => {
    expect(
      effectiveCalendarDate({
        ...base,
        flower_delivery_method: "maos",
        hand_delivery_date: "2026-09-14",
      }),
    ).toBe("2026-09-14");
  });

  it("cai na data do evento quando o método está marcado mas sem data", () => {
    expect(
      effectiveCalendarDate({ ...base, flower_delivery_method: "recolha_evento" }),
    ).toBe("2026-09-12");
  });

  // Flores secas: o form não pergunta data do evento — a única data que
  // existe é a da entrega das flores.
  it("flores secas: usa a entrega em mãos sem data do evento", () => {
    expect(
      effectiveCalendarDate({
        event_date: null,
        flower_delivery_method: "maos",
        hand_delivery_date: "2026-10-02",
        pickup_date: null,
      }),
    ).toBe("2026-10-02");
  });

  it("flores secas: aproveita a data mesmo sem método de envio marcado", () => {
    expect(
      effectiveCalendarDate({
        event_date: null,
        flower_delivery_method: null,
        hand_delivery_date: "2026-10-02",
        pickup_date: null,
      }),
    ).toBe("2026-10-02");
  });

  it("sem nenhuma data devolve null (não dá para agendar)", () => {
    expect(
      effectiveCalendarDate({
        event_date: null,
        flower_delivery_method: "ctt",
        pickup_date: null,
        hand_delivery_date: null,
      }),
    ).toBeNull();
  });
});

describe("calendarDateBecomesAvailable", () => {
  const secasSemData: CalendarDateFields = {
    event_date: null,
    flower_delivery_method: "maos",
    pickup_date: null,
    hand_delivery_date: null,
  };

  it("dispara quando a encomenda de secas ganha data de entrega", () => {
    expect(
      calendarDateBecomesAvailable(secasSemData, {
        ...secasSemData,
        hand_delivery_date: "2026-10-02",
      }),
    ).toBe(true);
  });

  it("não dispara quando já havia data (isso é uma actualização)", () => {
    expect(
      calendarDateBecomesAvailable(base, { ...base, event_date: "2026-09-20" }),
    ).toBe(false);
  });

  it("não dispara quando continua sem data nenhuma", () => {
    expect(
      calendarDateBecomesAvailable(secasSemData, {
        ...secasSemData,
        flower_delivery_method: "ctt",
      }),
    ).toBe(false);
  });
});
