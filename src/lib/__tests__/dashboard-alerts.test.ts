// Regra da Maria: os alertas do Dashboard começam em "Entrega agendada",
// inclusive. Uma pré-reserva ("Entrega de flores por agendar") ainda não é
// trabalho — enchia o cartão de linhas vermelhas por eventos e prazos de
// encomendas que podem nunca acontecer. Estes testes existem para a regra
// não se perder na próxima vez que se acrescentar um alerta novo.

import { describe, it, expect } from "vitest";
import { getDashboardAlerts } from "@/lib/dashboard";
import type { Order, OrderStatus } from "@/types/database";
import type { Voucher } from "@/types/voucher";

function daqui(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function order(over: Partial<Order>): Order {
  return {
    id: "id1",
    order_id: "ORD1",
    client_name: "Cliente",
    deleted_at: null,
    status: "entrega_agendada" as OrderStatus,
    contacted: false,
    created_at: daqui(-30),
    event_date: null,
    event_location: null,
    delivery_deadline: null,
    delivery_deadline_reason: null,
    freezer_in_at: null,
    freezer_out_at: null,
    partner_commission: null,
    partner_commission_status: "na",
    partner_id: null,
    email: null,
    phone: null,
    ...over,
  } as unknown as Order;
}

const SEM_VALES: Voucher[] = [];

describe("getDashboardAlerts — pré-reservas não geram alertas", () => {
  it("evento a 3 dias numa encomenda agendada alerta", () => {
    const alerts = getDashboardAlerts(
      [order({ status: "entrega_agendada", event_date: daqui(3) })],
      SEM_VALES,
    );
    expect(alerts.map((a) => a.id)).toEqual(["event-id1"]);
  });

  it("o mesmo evento numa pré-reserva não alerta", () => {
    const alerts = getDashboardAlerts(
      [order({ status: "entrega_flores_agendar", event_date: daqui(3) })],
      SEM_VALES,
    );
    expect(alerts).toHaveLength(0);
  });

  it("pré-reserva por contactar há muito tempo já não alerta (segue-se na aba Preservação)", () => {
    const alerts = getDashboardAlerts(
      [
        order({
          status: "entrega_flores_agendar",
          contacted: false,
          created_at: daqui(-10),
        }),
      ],
      SEM_VALES,
    );
    expect(alerts).toHaveLength(0);
  });

  it("prazo 'entregar até' de uma pré-reserva não alerta; o de uma agendada sim", () => {
    const preReserva = getDashboardAlerts(
      [order({ status: "entrega_flores_agendar", delivery_deadline: daqui(10) })],
      SEM_VALES,
    );
    expect(preReserva).toHaveLength(0);

    const agendada = getDashboardAlerts(
      [order({ status: "entrega_agendada", delivery_deadline: daqui(10) })],
      SEM_VALES,
    );
    expect(agendada.map((a) => a.id)).toEqual(["deadline-id1"]);
  });

  it("encomenda cancelada nunca alerta", () => {
    const alerts = getDashboardAlerts(
      [order({ status: "cancelado", event_date: daqui(2) })],
      SEM_VALES,
    );
    expect(alerts).toHaveLength(0);
  });
});
