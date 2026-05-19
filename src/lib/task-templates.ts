// ============================================================
// FBR Admin — Interpolação de variáveis em templates de tarefas
// ============================================================
// Os templates (tabela `task_templates`, mig 052) suportam variáveis
// no formato `{nome_cliente}`, `{nif}`, `{nome_parceiro}`, `{valor_comissao}`,
// `{valor}`. Esta função substitui-as pelos dados da encomenda/vale
// no momento da criação — o título guardado na BD já não tem `{...}`.
//
// Variáveis não encontradas são substituídas por "—". Maria pode então
// abrir a tarefa no kanban e completar à mão se quiser, mas evita o
// erro mais comum (mostrar literalmente `{nif}` numa fatura).
// ============================================================

import { formatEUR } from "@/lib/format";

export type TaskTemplateContext = {
  /** Nome do cliente (orders.client_name) ou remetente (vouchers.sender_name). */
  client_name?: string | null;
  /** NIF da encomenda (orders.nif). Só faz sentido para scope='order'. */
  nif?: string | null;
  /** Nome do parceiro recomendador (resolvido a partir de orders.partner_id). */
  partner_name?: string | null;
  /** Comissão do parceiro (orders.partner_commission). */
  partner_commission?: number | null;
  /** Valor escolhido no diálogo (templates com `needs_amount=true`). */
  amount?: number | null;
};

/**
 * Substitui as variáveis do template pelo contexto fornecido.
 * Variáveis sem valor no contexto ficam como "—".
 *
 * @example
 * interpolateTaskTemplate(
 *   "Passar fatura para {nome_cliente} — NIF: {nif}",
 *   { client_name: "João Silva", nif: "123456789" },
 * )
 * // → "Passar fatura para João Silva — NIF: 123456789"
 */
export function interpolateTaskTemplate(
  template: string,
  ctx: TaskTemplateContext,
): string {
  const replacements: Record<string, string> = {
    "{nome_cliente}":    ctx.client_name?.trim() || "—",
    "{nif}":             ctx.nif?.trim() || "—",
    "{nome_parceiro}":   ctx.partner_name?.trim() || "—",
    "{valor_comissao}":  ctx.partner_commission != null
                          ? formatEUR(ctx.partner_commission)
                          : "—",
    "{valor}":           ctx.amount != null ? formatEUR(ctx.amount) : "—",
  };
  return template.replace(/\{(?:nome_cliente|nif|nome_parceiro|valor_comissao|valor)\}/g, (m) => replacements[m] ?? m);
}

/**
 * Opções pré-calculadas para o diálogo "Qual é o valor a faturar?" de
 * templates com `needs_amount=true` num workbench de encomenda. Mostra
 * percentagens do orçamento (30/40/70/100) para corresponder aos estados
 * de pagamento do CLAUDE.md (30 sinal, 40 intermédio, 70 = sinal+intermédio,
 * 100 total). Vales-presente passam um único valor (o valor do vale) e
 * a UI esconde as percentagens.
 */
export type AmountOption = {
  label: string;     // "30% (€135,00)"
  value: number;     // 135
};

export function computeAmountOptionsFromBudget(budget: number | null | undefined): AmountOption[] {
  if (budget == null || budget <= 0) return [];
  const pct = [0.3, 0.4, 0.7, 1.0];
  return pct.map((p) => ({
    label: `${Math.round(p * 100)}% (${formatEUR(budget * p)})`,
    value: Math.round(budget * p * 100) / 100,
  }));
}

/**
 * Vales-presente são sempre pagos a 100% num só momento (vs. encomenda
 * que pode ser pago em 30/40/70/100). Para o diálogo da fatura, mostramos
 * apenas um botão com o valor total — o utilizador pode sempre escrever
 * outro valor no campo manual.
 */
export function computeAmountOptionsForVoucher(amount: number | null | undefined): AmountOption[] {
  if (amount == null || amount <= 0) return [];
  return [{ label: `Total (${formatEUR(amount)})`, value: amount }];
}
