import { describe, it, expect } from "vitest";
import { fieldSuggestionBases } from "../templates";

// Regras de sugestão de templates por campos da encomenda (sessão 118).
// O objectivo: a Maria não escolhe — se o cliente disse "não sei" no
// formulário, a template certa aparece sozinha.

describe("fieldSuggestionBases", () => {
  it("pré-reserva sem pagamento e tamanho 'não sei' → template do sinal 90€", () => {
    const bases = fieldSuggestionBases({
      status: "entrega_flores_agendar",
      payment_status: "100_por_pagar",
      frame_size: "nao_sei",
      flower_delivery_method: "maos",
    });
    expect(bases).toContain("pre_reserva_tamanho_indeciso");
    expect(bases).not.toContain("pre_reserva_tamanho_escolhido");
  });

  it("pré-reserva com tamanho escolhido → template do tamanho escolhido", () => {
    const bases = fieldSuggestionBases({
      status: "entrega_flores_agendar",
      payment_status: "100_por_pagar",
      frame_size: "40x50",
      flower_delivery_method: "ctt",
    });
    expect(bases).toContain("pre_reserva_tamanho_escolhido");
  });

  it("envio das flores 'não sei' → apresentar as 3 opções", () => {
    const bases = fieldSuggestionBases({
      status: "entrega_flores_agendar",
      payment_status: "100_por_pagar",
      frame_size: "30x40",
      flower_delivery_method: "nao_sei",
    });
    expect(bases).toContain("opcoes_entrega_flores");
  });

  it("funeral em pré-reserva → condolências primeiro", () => {
    const bases = fieldSuggestionBases({
      status: "entrega_flores_agendar",
      payment_status: "100_por_pagar",
      event_type: "funeral",
      frame_size: "30x40",
    });
    expect(bases[0]).toBe("funeral_condolencias");
  });

  it("recolha sem morada → pedir morada para orçamento", () => {
    const bases = fieldSuggestionBases({
      status: "entrega_agendada",
      payment_status: "30_pago",
      flower_delivery_method: "recolha_evento",
      pickup_address: null,
    });
    expect(bases).toContain("recolha_orcamento");
    expect(bases).toContain("confirmacao_reserva_recolha");
  });

  it("reserva confirmada com CTT → confirmação CTT + enviar hoje", () => {
    const bases = fieldSuggestionBases({
      status: "entrega_agendada",
      payment_status: "30_pago",
      flower_delivery_method: "ctt",
    });
    expect(bases).toContain("confirmacao_reserva_ctt");
    expect(bases).toContain("ctt_enviar_hoje");
    expect(bases).toContain("preparacao_flores");
  });

  it("flores recebidas → 2ª parcela", () => {
    const bases = fieldSuggestionBases({
      status: "flores_recebidas",
      payment_status: "30_pago",
    });
    expect(bases).toContain("recepcao_flores_2a_parcela");
  });

  it("pagamento em dinheiro à entrega → confirmação própria, não a de mãos", () => {
    const bases = fieldSuggestionBases({
      status: "entrega_agendada",
      payment_status: "100_por_pagar",
      flower_delivery_method: "maos",
      cash_on_delivery: true,
    });
    expect(bases).toContain("confirmacao_reserva_dinheiro");
    expect(bases).not.toContain("confirmacao_reserva_maos");
  });

  it("encomenda coberta por vale-presente → não pedir sinal", () => {
    const bases = fieldSuggestionBases({
      status: "entrega_flores_agendar",
      payment_status: "100_por_pagar",
      frame_size: "30x40",
      gift_voucher_code: "A7K9X2",
    });
    expect(bases).toContain("vale_reserva_coberta");
    expect(bases).not.toContain("pre_reserva_tamanho_escolhido");
    expect(bases).not.toContain("pre_reserva_tamanho_indeciso");
  });

  it("quadro enviado → mensagem com tracking", () => {
    const bases = fieldSuggestionBases({
      status: "quadro_enviado",
      payment_status: "100_pago",
    });
    expect(bases).toContain("quadro_enviado_tracking");
  });

  it("fase de design com sinal âncora e tamanho decidido → reajuste (mig 074)", () => {
    const bases = fieldSuggestionBases({
      status: "flores_na_prensa",
      payment_status: "30_pago",
      frame_size: "50x70",
      budget_at_first_payment: 300,
    });
    expect(bases).toContain("reajuste_pagamento_tamanho");
    expect(bases).not.toContain("orientacao_quadro");
  });
});
