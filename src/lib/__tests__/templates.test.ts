import { describe, it, expect } from "vitest";
import {
  fieldSuggestionBases,
  rankTemplatesForStatus,
  renderOrderTemplate,
  requiredContentPoints,
  templateSnippet,
} from "../templates";
import type { MessageTemplate, TemplateLanguage, SystemSettingsMap } from "@/types/message-template";
import type { Order, OrderStatus } from "@/types/database";
import type { PricingSnapshot } from "@/types/pricing";

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

// Sessão 123: as sugeridas por estado (suggested_statuses) passaram a
// ser filtradas pelos campos da encomenda e pelo idioma do cliente —
// na pré-reserva havia ~18 sugeridas (9 bases × PT/EN), incluindo
// contradições (condolências num casamento, "tamanho indeciso" com o
// tamanho já escolhido). Nada desaparece: o que não é relevante desce
// para "Todos os templates".

let seq = 0;
function tpl(
  base: string,
  language: TemplateLanguage,
  statuses: OrderStatus[],
): MessageTemplate {
  seq += 1;
  return {
    id: `t${seq}`,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
    deleted_at: null,
    created_by: null,
    updated_by: null,
    slug: `${base}_${language}`,
    name: base,
    language,
    category: "pre_reserva",
    body: "…",
    suggested_statuses: statuses,
    scope: "order",
    position: seq,
    is_seed: true,
  };
}

// Par PT+EN da mesma base, como nos seeds das migrações 041/080
function par(base: string, statuses: OrderStatus[]): MessageTemplate[] {
  return [tpl(base, "pt", statuses), tpl(base, "en", statuses)];
}

// Conteúdos obrigatórios da próxima mensagem (sessão 152). O que o
// cliente deixou em "Mais info" no formulário tem de ser explicado —
// sem preços, por decisão da Maria.

describe("requiredContentPoints", () => {
  const preReserva = {
    status: "entrega_flores_agendar",
    payment_status: "100_por_pagar",
    flower_delivery_method: "maos",
  };
  const keys = (o: Parameters<typeof requiredContentPoints>[0]) =>
    requiredContentPoints(o).map((p) => p.key);

  it("ornamentos de Natal em 'mais info' → ponto obrigatório com a quantidade", () => {
    const points = requiredContentPoints({
      ...preReserva,
      christmas_ornaments: "mais_info",
      christmas_ornaments_qty: 3,
    });
    const ornamentos = points.find((p) => p.key === "ornamentos_natal_info");
    expect(ornamentos).toBeDefined();
    expect(ornamentos!.text).toContain("indicou 3");
    // A Maria decidiu que os extras se explicam sem falar de valores.
    expect(ornamentos!.text).toContain("NÃO indicar preços");
  });

  it("pendentes e quadros extra em 'mais info' → um ponto cada", () => {
    expect(
      keys({
        ...preReserva,
        necklace_pendants: "mais_info",
        extra_small_frames: "mais_info",
      }),
    ).toEqual(
      expect.arrayContaining(["pendentes_colares_info", "quadros_extra_info"]),
    );
  });

  it("'sim' ou 'não' não geram pendência — só 'mais info'", () => {
    expect(
      keys({
        ...preReserva,
        christmas_ornaments: "sim",
        necklace_pendants: "nao",
        extra_small_frames: null,
      }),
    ).toEqual([]);
  });

  it("envio das flores 'não sei' → obriga a apresentar as 3 opções", () => {
    expect(
      keys({ ...preReserva, flower_delivery_method: "nao_sei" }),
    ).toContain("opcoes_envio_flores");
    // Campo por preencher conta como "não sei"
    expect(
      keys({ ...preReserva, flower_delivery_method: null }),
    ).toContain("opcoes_envio_flores");
  });

  it("recolha no evento sem morada → obriga a pedir a morada", () => {
    expect(
      keys({ ...preReserva, flower_delivery_method: "recolha_evento" }),
    ).toContain("morada_recolha");
    // Com morada já preenchida deixa de ser pendência
    expect(
      keys({
        ...preReserva,
        flower_delivery_method: "recolha_evento",
        pickup_address: "Rua das Flores 1, Coimbra",
      }),
    ).not.toContain("morada_recolha");
  });

  it("encomendas fechadas não geram pendências", () => {
    for (const status of ["quadro_recebido", "cancelado"]) {
      expect(
        keys({
          ...preReserva,
          status,
          christmas_ornaments: "mais_info",
          necklace_pendants: "mais_info",
        }),
      ).toEqual([]);
    }
  });

  it("fundo do quadro não gera ponto obrigatório (decisão da Maria: B6 não)", () => {
    // Sem campo de fundo na interface — garantimos que nada aparece por
    // outras vias quando o resto está resolvido.
    expect(
      keys({ ...preReserva, frame_size: "nao_sei" }),
    ).toEqual([]);
  });
});

describe("rankTemplatesForStatus — filtro por campos e idioma", () => {
  const preReserva: OrderStatus[] = ["entrega_flores_agendar"];
  // As 9 bases marcadas para pré-reserva na migração 080
  const catalogo: MessageTemplate[] = [
    ...par("funeral_condolencias", preReserva),
    ...par("pre_reserva_tamanho_escolhido", preReserva),
    ...par("pre_reserva_tamanho_indeciso", preReserva),
    ...par("lembrete_reserva_nao_paga", preReserva),
    ...par("seguimento_sem_resposta", preReserva),
    ...par("opcoes_entrega_flores", preReserva),
    ...par("recolha_orcamento", preReserva),
    ...par("ctt_enviar_hoje", preReserva),
    ...par("vale_reserva_coberta", preReserva),
  ];

  it("casamento EN, tamanho escolhido, envio por decidir → só 4 sugeridas relevantes", () => {
    const { suggested, others } = rankTemplatesForStatus(catalogo, {
      scope: "order",
      currentStatus: "entrega_flores_agendar",
      preferredLanguage: "en",
      orderFields: {
        status: "entrega_flores_agendar",
        payment_status: "100_por_pagar",
        event_type: "casamento",
        frame_size: "30x40",
        flower_delivery_method: null,
      },
    });
    expect(suggested.map((t) => t.slug)).toEqual([
      "pre_reserva_tamanho_escolhido_en",
      "opcoes_entrega_flores_en",
      "lembrete_reserva_nao_paga_en",
      "seguimento_sem_resposta_en",
    ]);
    // Nada se perde: o resto continua em "Todos os templates"
    expect(suggested.length + others.length).toBe(catalogo.length);
  });

  it("funeral → condolências no topo; nunca em casamentos", () => {
    const { suggested } = rankTemplatesForStatus(catalogo, {
      scope: "order",
      currentStatus: "entrega_flores_agendar",
      preferredLanguage: "pt",
      orderFields: {
        status: "entrega_flores_agendar",
        payment_status: "100_por_pagar",
        event_type: "funeral",
        frame_size: "30x40",
        flower_delivery_method: "maos",
      },
    });
    expect(suggested[0].slug).toBe("funeral_condolencias_pt");
  });

  it("coberta por vale-presente → sugere a do vale, nunca pede sinal", () => {
    const { suggested } = rankTemplatesForStatus(catalogo, {
      scope: "order",
      currentStatus: "entrega_flores_agendar",
      preferredLanguage: "pt",
      orderFields: {
        status: "entrega_flores_agendar",
        payment_status: "100_por_pagar",
        frame_size: "30x40",
        flower_delivery_method: "maos",
        gift_voucher_code: "A7K9X2",
      },
    });
    const slugs = suggested.map((t) => t.slug);
    expect(slugs).toContain("vale_reserva_coberta_pt");
    expect(slugs).not.toContain("pre_reserva_tamanho_escolhido_pt");
    expect(slugs).not.toContain("lembrete_reserva_nao_paga_pt");
  });

  it("template sem gémea no idioma do cliente mantém-se sugerida", () => {
    const soPt = [tpl("seguimento_sem_resposta", "pt", preReserva)];
    const { suggested } = rankTemplatesForStatus(soPt, {
      scope: "order",
      currentStatus: "entrega_flores_agendar",
      preferredLanguage: "en",
      orderFields: {
        status: "entrega_flores_agendar",
        payment_status: "100_por_pagar",
        frame_size: "30x40",
        flower_delivery_method: "maos",
      },
    });
    expect(suggested.map((t) => t.slug)).toEqual(["seguimento_sem_resposta_pt"]);
  });

  it("sem orderFields (ex: vale) o filtro por campos não se aplica", () => {
    const { suggested } = rankTemplatesForStatus(catalogo, {
      scope: "order",
      currentStatus: "entrega_flores_agendar",
    });
    // Sem campos nem idioma: comportamento antigo (tudo o que bate no estado)
    expect(suggested.length).toBe(catalogo.length);
  });
});

// Snippet nas listas de templates (sessão 127): a primeira frase ÚTIL,
// saltando saudações — incluindo as escritas à mão ("Bom dia, {nome}",
// "Cara {nome},"), que apareciam como snippet e não diziam nada.

describe("templateSnippet", () => {
  it("salta a linha {saudacao} e mostra a frase seguinte", () => {
    expect(
      templateSnippet("{saudacao} {nome} 🌷\n\nAntes de mais, muitos parabéns!"),
    ).toBe("Antes de mais, muitos parabéns!");
  });

  it("salta saudações escritas à mão (Bom dia / Cara / Dear)", () => {
    expect(
      templateSnippet("Bom dia, {nome} 🌷\n\nChegou o momento de escolher a moldura."),
    ).toBe("Chegou o momento de escolher a moldura.");
    expect(
      templateSnippet("Cara {nome},\n\nSegue em anexo a fatura."),
    ).toBe("Segue em anexo a fatura.");
    expect(
      templateSnippet("Dear {nome},\n\nYour frame is ready! 🎉"),
    ).toBe("Your frame is ready! 🎉");
    // "Olá" tem vogal acentuada — \b em JS falharia aqui (bug real do
    // template pós-venda: o snippet mostrava "Olá {nome} 🌸").
    expect(
      templateSnippet("Olá {nome} 🌸\n\nEsperamos que esteja a gostar do seu quadro!"),
    ).toBe("Esperamos que esteja a gostar do seu quadro!");
  });

  it("não salta primeiras linhas que começam por saudação mas têm substância", () => {
    expect(
      templateSnippet("Olá! O seu quadro já seguiu viagem para a sua morada."),
    ).toBe("Olá! O seu quadro já seguiu viagem para a sua morada.");
  });

  it("se o corpo for só a saudação, mostra-a na mesma (melhor que vazio)", () => {
    expect(templateSnippet("{saudacao} {nome} 🌷")).toBe("{saudacao} {nome} 🌷");
  });

  it("trunca frases longas ao limite", () => {
    const longa = "Relativamente ao envio do quadro final, ".repeat(6);
    expect(templateSnippet(longa).length).toBeLessThanOrEqual(121);
    expect(templateSnippet(longa).endsWith("…")).toBe(true);
  });
});

// Render de valores monetários (sessão 148): quando a Maria edita o
// orçamento à mão (ex.: desconto de família), o sinal/parcelas/valor do
// quadro nas mensagens têm de seguir o orçamento editado — não o snapshot
// original. Antes o snapshot ganhava e a mensagem ignorava o desconto.

describe("renderOrderTemplate — valores seguem o orçamento editável", () => {
  const settings = {
    payment_mbway: "934 680 300",
    payment_iban: "PT50 0000",
    payment_account_holder: "Maria João Brito",
    payment_bic: "XXXX",
    payment_bank_name: "Banco",
    review_link: "",
    studio_address_url: "",
    studio_address_text: "",
  } as unknown as SystemSettingsMap;

  function order(over: Partial<Order>): Order {
    return {
      id: "o1",
      order_id: "ABCD1234",
      client_name: "Ana Silva",
      event_date: "2026-05-15",
      frame_size: "30x40",
      status: "entrega_flores_agendar",
      payment_status: "100_por_pagar",
      budget: null,
      budget_at_first_payment: null,
      pricing_snapshot: null,
      ...over,
    } as unknown as Order;
  }

  const snap300: PricingSnapshot = {
    computed_at: "2026-01-01",
    total: 300,
    lines: [
      { category: "base_frame", key: "30x40", label: "Moldura 30x40", qty: 1, unit_price: 300, subtotal: 300 },
    ],
  };

  const tplBody = (b: string): MessageTemplate =>
    ({ language: "pt", body: b } as MessageTemplate);

  it("orçamento editado (desconto) manda sobre o snapshot no sinal e no valor do quadro", () => {
    const out = renderOrderTemplate(
      tplBody("quadro {valor_quadro}, sinal {valor_sinal}, total {valor_total}"),
      { order: order({ budget: 270, pricing_snapshot: snap300 }), settings },
    );
    // 30% de 270 = 81€ (não 90€ do snapshot); quadro absorve o desconto → 270€
    expect(out).toBe("quadro 270€, sinal 81€, total 270€");
  });

  it("sem edição (orçamento == snapshot) mantém os valores do snapshot", () => {
    const out = renderOrderTemplate(
      tplBody("quadro {valor_quadro}, sinal {valor_sinal}"),
      { order: order({ budget: 300, pricing_snapshot: snap300 }), settings },
    );
    expect(out).toBe("quadro 300€, sinal 90€");
  });

  it("encomenda antiga sem budget cai no snapshot", () => {
    const out = renderOrderTemplate(
      tplBody("sinal {valor_sinal}"),
      { order: order({ budget: null, pricing_snapshot: snap300 }), settings },
    );
    expect(out).toBe("sinal 90€");
  });
});

// {resumo_encomenda} (sessão 156): as mensagens falavam sempre só do
// quadro principal e nunca dos extras que a cliente encomendou, apesar de
// o total estar certo. A variável existia desde a 147 mas não estava em
// nenhuma template (mig 103 põe-na lá).

describe("renderOrderTemplate — {resumo_encomenda}", () => {
  const settings = {
    payment_mbway: "",
    payment_iban: "",
    payment_account_holder: "",
    payment_bic: "",
    payment_bank_name: "",
    review_link: "",
    studio_address_url: "",
    studio_address_text: "",
  } as unknown as SystemSettingsMap;

  function order(over: Partial<Order>): Order {
    return {
      id: "o1",
      order_id: "ABCD1234",
      client_name: "Ana Silva",
      frame_size: "30x40",
      status: "entrega_flores_agendar",
      payment_status: "100_por_pagar",
      budget: null,
      budget_at_first_payment: null,
      pricing_snapshot: null,
      ...over,
    } as unknown as Order;
  }

  const tpl = (language: TemplateLanguage): MessageTemplate =>
    ({ language, body: "{resumo_encomenda}" } as MessageTemplate);

  // Caso da Maria: quadro 30x40 (300€) + 2 ornamentos de Natal (50€).
  const snapComExtras: PricingSnapshot = {
    computed_at: "2026-01-01",
    total: 350,
    lines: [
      { category: "base_frame", key: "30x40", label: "Moldura 30x40", qty: 1, unit_price: 300, subtotal: 300 },
      { category: "background_supplement", key: "preto", label: "Fundo preto", qty: 1, unit_price: 0, subtotal: 0 },
      { category: "extra", key: "christmas_ornament", label: "Ornamento de Natal", qty: 2, unit_price: 25, subtotal: 50 },
    ],
  };

  it("lista o quadro E os extras, com unitário e total", () => {
    const out = renderOrderTemplate(tpl("pt"), {
      order: order({ budget: 350, pricing_snapshot: snapComExtras }),
      settings,
    });
    expect(out).toBe(
      "• Quadro 30x40 cm (300€)\n• 2× Ornamento de Natal (2 × 25€ = 50€)\n\nTotal: 350€",
    );
  });

  it("traduz os rótulos nas templates EN", () => {
    const out = renderOrderTemplate(tpl("en"), {
      order: order({ budget: 350, pricing_snapshot: snapComExtras }),
      settings,
    });
    expect(out).toBe(
      "• 30x40 cm frame (300€)\n• 2× Christmas ornament (2 × 25€ = 50€)\n\nTotal: 350€",
    );
  });

  it("com um só item não repete o total", () => {
    const snap: PricingSnapshot = {
      computed_at: "2026-01-01",
      total: 300,
      lines: [
        { category: "base_frame", key: "30x40", label: "Moldura 30x40", qty: 1, unit_price: 300, subtotal: 300 },
      ],
    };
    const out = renderOrderTemplate(tpl("pt"), {
      order: order({ budget: 300, pricing_snapshot: snap }),
      settings,
    });
    expect(out).toBe("• Quadro 30x40 cm (300€)");
  });

  it("orçamento editado à mão: o desconto entra no quadro e os itens somam o total", () => {
    const out = renderOrderTemplate(tpl("pt"), {
      order: order({ budget: 320, pricing_snapshot: snapComExtras }),
      settings,
    });
    // 350 → 320: o quadro absorve os 30€ de desconto (mesma regra do {valor_quadro})
    expect(out).toBe(
      "• Quadro 30x40 cm (270€)\n• 2× Ornamento de Natal (2 × 25€ = 50€)\n\nTotal: 320€",
    );
  });

  it("encomenda sem snapshot cai numa linha só com o orçamento", () => {
    const out = renderOrderTemplate(tpl("pt"), {
      order: order({ budget: 400, frame_size: "40x50", pricing_snapshot: null }),
      settings,
    });
    expect(out).toBe("• Quadro 40x50 cm (400€)");
  });
});

// ── Vale-presente: restante a pagar vs. crédito que sobra (mig 106) ──
describe("vale-presente com valor conhecido", () => {
  const base = {
    status: "entrega_flores_agendar",
    payment_status: "100_por_pagar",
    frame_size: "40x50",
    gift_voucher_code: "A7K9X2",
  };

  it("orçamento maior do que o vale → template com restante", () => {
    const bases = fieldSuggestionBases({ ...base, budget: 490, gift_voucher_amount: 300 });
    expect(bases).toContain("vale_reserva_restante");
    expect(bases).not.toContain("vale_reserva_coberta");
  });

  it("vale igual ou maior do que o orçamento → reserva coberta", () => {
    expect(fieldSuggestionBases({ ...base, budget: 300, gift_voucher_amount: 300 })).toContain("vale_reserva_coberta");
    expect(fieldSuggestionBases({ ...base, budget: 300, gift_voucher_amount: 400 })).toContain("vale_reserva_coberta");
  });

  it("sem valor do vale → comportamento antigo (coberta)", () => {
    expect(fieldSuggestionBases({ ...base, budget: 900 })).toContain("vale_reserva_coberta");
  });

  it("variáveis: desconto, restante e crédito", () => {
    const settings = {} as Parameters<typeof renderOrderTemplate>[1]["settings"];
    const tpl = (body: string) =>
      ({ slug: "x_pt", name: "x", language: "pt", category: "vale_presente", scope: "order", position: 1, is_seed: false, suggested_statuses: [], body }) as unknown as Parameters<typeof renderOrderTemplate>[0];
    const ordem = (over: Record<string, unknown>) =>
      ({ client_name: "Ana", gift_voucher_code: "A7K9X2", order_id: "X", ...over }) as unknown as Parameters<typeof renderOrderTemplate>[1]["order"];

    const restante = renderOrderTemplate(tpl("{codigo_vale} {valor_vale_desconto} {valor_restante}[{credito_vale}]"), {
      order: ordem({ budget: 490, gift_voucher_amount: 300 }), settings,
    });
    expect(restante).toBe("A7K9X2 300€ 190€[]");

    const credito = renderOrderTemplate(tpl("{valor_vale_desconto} {valor_restante}{credito_vale}"), {
      order: ordem({ budget: 300, gift_voucher_amount: 400 }), settings,
    });
    expect(credito.startsWith("300€ 0€\n\nSobram ainda 100€ de crédito do vale")).toBe(true);

    const semValor = renderOrderTemplate(tpl("[{valor_restante}][{credito_vale}]"), {
      order: ordem({ budget: 300 }), settings,
    });
    expect(semValor).toBe("[][]");
  });
});
