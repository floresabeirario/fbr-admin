// ============================================================
// Pendências da encomenda vs. o que já foi dito à cliente
// ============================================================
// `requiredContentPoints` (templates.ts) diz o que ficou por resolver no
// formulário: extras marcados como "Mais info", envio das flores "não
// sei", recolha sem morada. Até à sessão 166 esses pontos iam para o
// prompt como OBRIGATÓRIO em TODAS as mensagens, enquanto a encomenda
// não fechasse. Resultado: a cliente perguntava a que horas era a
// recolha e a resposta vinha outra vez com a explicação dos ornamentos
// de Natal, pela terceira vez.
//
// Este módulo cruza cada pendência com o que a FBR já escreveu (eco do
// WhatsApp + emails enviados) e diz se já foi tratada e quando. A
// decisão de a repetir ou não passa a ser do modelo, com esta
// informação à frente, em vez de uma ordem cega.
// ============================================================

import type { RequiredContentPoint } from "@/lib/templates";
import { formatDateLisbon } from "@/lib/format-date";

/** Mensagem nossa (WhatsApp ou email) com data ISO. */
export interface MensagemFbr {
  text: string;
  at: string;
}

export interface PendenciaClassificada extends RequiredContentPoint {
  /** dd/MM/yyyy da mensagem nossa que já tratou o assunto; null se nunca. */
  tratadaEm: string | null;
}

// Uma pendência conta como tratada quando uma mensagem nossa bate em
// TODOS os grupos de padrões da chave (cada grupo = uma ideia que tem
// de lá estar). Assim "recolha" sozinha não conta como ter apresentado
// as 3 opções de envio, mas "recolha" + "CTT" já conta.
const PADROES: Record<string, RegExp[]> = {
  ornamentos_natal_info: [/ornament|\bnatal\b|christmas|\bbolas?\b/i],
  pendentes_colares_info: [/pendente|pendant|\bcolar(es)?\b|necklace/i],
  quadros_extra_info: [
    /quadro(s)? (extra|pequen|mais pequen)|quadrinho|\bmini(s|-quadro| quadro)?\b|20 ?x ?25|small frame|extra frame|mini frame/i,
  ],
  opcoes_envio_flores: [
    /\bctt\b|correio|transportadora|courier|post office|by post|shipping/i,
    /recolh|pick[- ]?up|collect/i,
  ],
  morada_recolha: [/morada|endere[çc]o|address|localiza[çc][ãa]o/i],
};

function trataDe(texto: string, key: string): boolean {
  const grupos = PADROES[key];
  if (!grupos) return false;
  return grupos.every((re) => re.test(texto));
}

/**
 * Marca cada pendência com a data da primeira mensagem nossa que a
 * tratou (ou null). As mensagens podem vir em qualquer ordem.
 */
export function classificarPendencias(
  pontos: RequiredContentPoint[],
  mensagensFbr: MensagemFbr[],
): PendenciaClassificada[] {
  const ordenadas = [...mensagensFbr]
    .filter((m) => m.text && m.text.trim())
    .sort((a, b) => a.at.localeCompare(b.at));
  return pontos.map((p) => {
    const hit = ordenadas.find((m) => trataDe(m.text, p.key));
    return { ...p, tratadaEm: hit ? formatDateLisbon(hit.at) : null };
  });
}

/**
 * Bloco para o prompt. Vazio se não houver pendências.
 *
 * Duas listas: o que ainda está por tratar e o que já foi dito. A
 * instrução deixa de ser "cobre tudo em todas as mensagens" e passa a
 * ser "trata-as quando é a altura, uma vez". O modelo é que sabe se
 * esta mensagem é a de abertura da fase ou uma resposta a outra coisa.
 */
export function pendenciasBlock(pendencias: PendenciaClassificada[]): string {
  if (pendencias.length === 0) return "";
  const porTratar = pendencias.filter((p) => !p.tratadaEm);
  const tratadas = pendencias.filter((p) => p.tratadaEm);

  const partes: string[] = [
    "\n\n## Pendências desta encomenda (o que a cliente deixou em aberto no formulário)",
  ];

  if (porTratar.length) {
    partes.push(
      `\nAinda por tratar:\n${porTratar.map((p) => `- ${p.text}`).join("\n")}`,
      "\nComo as usar: se esta mensagem é a nossa primeira desta fase (por exemplo, a mensagem da template base), trata estas pendências nela, integradas no texto. Se a cliente perguntou outra coisa, responde primeiro a isso e inclui uma pendência só se encaixar naturalmente; não é obrigatório esgotá-las todas de uma vez. Cada pendência trata-se uma vez: nas mensagens seguintes só volta se a cliente perguntar.",
    );
  }

  if (tratadas.length) {
    partes.push(
      `\nJá tratadas por nós (não repetir, a não ser que a cliente volte a perguntar):\n${tratadas
        .map((p) => `- ${resumoCurto(p.key)} (explicado a ${p.tratadaEm})`)
        .join("\n")}`,
    );
  }

  return partes.join("\n");
}

function resumoCurto(key: string): string {
  switch (key) {
    case "ornamentos_natal_info":
      return "Ornamentos de Natal";
    case "pendentes_colares_info":
      return "Pendentes para colares";
    case "quadros_extra_info":
      return "Quadros extra pequenos";
    case "opcoes_envio_flores":
      return "As 3 opções de envio das flores";
    case "morada_recolha":
      return "Pedido da morada da recolha (se ela ainda não respondeu, podes lembrar com delicadeza)";
    default:
      return key;
  }
}
