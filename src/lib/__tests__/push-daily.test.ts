// Testes da lógica pura das notificações push diárias (sessão de push).
// Regras da Maria: recolha/flores "amanhã" e congelador com 5 dias
// COMPLETOS (120h). Envio CTT das flores fica de fora de propósito.

import { describe, it, expect } from "vitest";
import { computeDailyPushItems, tomorrowLisbonYMD } from "@/lib/push/daily";
import type { Order } from "@/types/database";

// "now" fixo: 2026-07-03 09:00 UTC = 10:00 em Lisboa (verão) → amanhã = 04/07.
const NOW = new Date("2026-07-03T09:00:00Z");

function order(over: Partial<Order>): Order {
  return {
    id: "id1",
    order_id: "ORD1",
    client_name: "Cliente",
    deleted_at: null,
    status: "entrega_agendada",
    flower_delivery_method: "maos",
    pickup_date: null,
    event_date: null,
    pickup_address: null,
    event_location: null,
    hand_delivery_date: null,
    freezer_in_at: null,
    freezer_out_at: null,
    ...over,
  } as Order;
}

function keys(orders: Order[]): string[] {
  return computeDailyPushItems(orders, NOW).map((i) => i.dedupKey);
}

describe("tomorrowLisbonYMD", () => {
  it("dá o dia seguinte em hora de Portugal", () => {
    expect(tomorrowLisbonYMD(NOW)).toBe("2026-07-04");
  });
});

describe("congelador — 5 dias completos (120h)", () => {
  it("inclui quando já passaram 120h exactas", () => {
    const o = order({ freezer_in_at: "2026-06-28T09:00:00Z", flower_delivery_method: "ctt" });
    expect(keys([o])).toEqual(["freezer5:id1:2026-06-28T09:00:00Z"]);
  });

  it("NÃO inclui às 119h (faltam minutos para os 5 dias)", () => {
    const o = order({ freezer_in_at: "2026-06-28T10:00:00Z", flower_delivery_method: "ctt" });
    expect(keys([o])).toEqual([]);
  });

  it("NÃO inclui se as flores já saíram do congelador", () => {
    const o = order({
      freezer_in_at: "2026-06-20T09:00:00Z",
      freezer_out_at: "2026-06-27T09:00:00Z",
      flower_delivery_method: "ctt",
    });
    expect(keys([o])).toEqual([]);
  });
});

describe("recolha amanhã", () => {
  it("inclui recolha_evento com pickup_date amanhã", () => {
    const o = order({
      id: "r1",
      flower_delivery_method: "recolha_evento",
      pickup_date: "2026-07-04",
      pickup_address: "Igreja de Braga",
    });
    expect(keys([o])).toEqual(["recolha:r1:2026-07-04"]);
  });

  it("usa event_date quando não há pickup_date", () => {
    const o = order({
      id: "r2",
      flower_delivery_method: "recolha_evento",
      event_date: "2026-07-04",
    });
    expect(keys([o])).toEqual(["recolha:r2:2026-07-04"]);
  });

  it("NÃO inclui se a recolha é hoje (não amanhã)", () => {
    const o = order({
      flower_delivery_method: "recolha_evento",
      pickup_date: "2026-07-03",
    });
    expect(keys([o])).toEqual([]);
  });

  it("NÃO inclui pré-reservas nem canceladas", () => {
    const pre = order({
      flower_delivery_method: "recolha_evento",
      pickup_date: "2026-07-04",
      status: "entrega_flores_agendar",
    });
    const cancel = order({
      flower_delivery_method: "recolha_evento",
      pickup_date: "2026-07-04",
      status: "cancelado",
    });
    expect(keys([pre, cancel])).toEqual([]);
  });
});

describe("flores a chegar amanhã (entrega em mãos)", () => {
  it("inclui maos com hand_delivery_date amanhã", () => {
    const o = order({
      id: "m1",
      flower_delivery_method: "maos",
      hand_delivery_date: "2026-07-04",
    });
    expect(keys([o])).toEqual(["flores:m1:2026-07-04"]);
  });

  it("NÃO inclui envio CTT das flores (sem data de chegada fiável)", () => {
    const o = order({
      flower_delivery_method: "ctt",
      event_date: "2026-07-04",
    });
    expect(keys([o])).toEqual([]);
  });
});

describe("encomendas apagadas", () => {
  it("são sempre ignoradas", () => {
    const o = order({
      deleted_at: "2026-07-01T00:00:00Z",
      flower_delivery_method: "maos",
      hand_delivery_date: "2026-07-04",
      freezer_in_at: "2026-06-01T00:00:00Z",
    });
    expect(keys([o])).toEqual([]);
  });
});
