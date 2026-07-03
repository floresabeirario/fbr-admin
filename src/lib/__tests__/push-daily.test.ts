// Testes da lógica pura das notificações push diárias (sessão de push).
// Regras da Maria: recolha/flores "amanhã" e congelador com 5 dias
// COMPLETOS (120h). Envio CTT das flores fica de fora de propósito.

import { describe, it, expect } from "vitest";
import {
  computeDailyPushItems,
  computeTaskDeadlineItems,
  tomorrowLisbonYMD,
} from "@/lib/push/daily";
import type { Order } from "@/types/database";
import type { Task } from "@/types/tasks";

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

// ── Prazos de tarefas (3 dias e 1 dia antes) ─────────────────
function task(over: Partial<Task>): Task {
  return {
    id: "t1",
    title: "Comprar molduras",
    due_date: null,
    done: false,
    deleted_at: null,
    assignee_emails: ["info+ana@floresabeirario.pt"],
    ...over,
  } as Task;
}

describe("prazos de tarefas", () => {
  it("avisa 3 dias antes (due 06/07) com a pessoa atribuída", () => {
    const items = computeTaskDeadlineItems([task({ due_date: "2026-07-06" })], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].dedupKey).toBe("taskdue:t1:2026-07-06:3");
    expect(items[0].recipients).toEqual(["info+ana@floresabeirario.pt"]);
    expect(items[0].payload.title).toContain("3 dias");
  });

  it("avisa 1 dia antes (due 04/07) com título de amanhã", () => {
    const items = computeTaskDeadlineItems([task({ id: "t2", due_date: "2026-07-04" })], NOW);
    expect(items.map((i) => i.dedupKey)).toEqual(["taskdue:t2:2026-07-04:1"]);
    expect(items[0].payload.title).toContain("amanhã");
  });

  it("NÃO avisa a 2 dias (só 3 e 1)", () => {
    expect(computeTaskDeadlineItems([task({ due_date: "2026-07-05" })], NOW)).toEqual([]);
  });

  it("ignora tarefas feitas, apagadas ou sem prazo", () => {
    const done = task({ due_date: "2026-07-04", done: true });
    const del = task({ due_date: "2026-07-04", deleted_at: "2026-07-01T00:00:00Z" });
    const noDate = task({ due_date: null });
    expect(computeTaskDeadlineItems([done, del, noDate], NOW)).toEqual([]);
  });

  it("tarefa sem responsável cai para os admins (recipients ausente)", () => {
    const items = computeTaskDeadlineItems([task({ due_date: "2026-07-04", assignee_emails: [] })], NOW);
    expect(items).toHaveLength(1);
    expect(items[0].recipients).toBeUndefined();
  });
});
