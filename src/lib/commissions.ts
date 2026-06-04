// ============================================================
// FBR Admin — Comissões de parcerias por saldar
// ============================================================
// As comissões vivem nas encomendas (orders) E nos vales (vouchers),
// cada uma com um valor (€), um parceiro e um estado. Este helper
// consolida ambas numa lista única para a vista "Comissões" das
// Parcerias, classificando cada comissão consoante já é uma dívida a
// pagar agora ou ainda não é devida.

import type { PartnerCommissionStatus } from "@/types/database";

export type CommissionKind = "order" | "voucher";

export interface CommissionItem {
  kind: CommissionKind;
  /** id (uuid) da linha em orders/vouchers — usado para marcar como paga */
  rowId: string;
  /** código legível (order_id alfanumérico ou code do vale) para o link */
  code: string;
  partnerId: string;
  /** Nome a mostrar: cliente da encomenda ou remetente→destinatário do vale */
  label: string;
  amount: number | null;
  status: PartnerCommissionStatus;
  /** ISO do último update — para "há quanto tempo está pendente" */
  updatedAt: string;
}

// Estados que representam uma comissão por SALDAR. `na` (sem parceiro) e
// `nao_aceita` (parceiro recusou) não são dívida; `paga` já está saldada.
export const COMMISSION_PENDING_STATUSES: readonly PartnerCommissionStatus[] = [
  "parceiro_informado",
  "a_aguardar_resposta",
  "a_aguardar",
];

// Dentro das pendentes, distinguimos as que já são uma dívida a tratar
// AGORA das que ainda não são devidas porque o cliente ainda não pagou a
// encomenda na totalidade (`a_aguardar` = "Encomenda não paga na totalidade").
const NOT_YET_DUE: ReadonlySet<PartnerCommissionStatus> = new Set(["a_aguardar"]);

export function isCommissionDueNow(status: PartnerCommissionStatus): boolean {
  return (
    COMMISSION_PENDING_STATUSES.includes(status) && !NOT_YET_DUE.has(status)
  );
}

export function isCommissionNotYetDue(status: PartnerCommissionStatus): boolean {
  return NOT_YET_DUE.has(status);
}

export interface PartnerCommissionGroup {
  partnerId: string;
  partnerName: string;
  items: CommissionItem[];
  total: number;
}

/**
 * Agrupa as comissões por parceiro, somando o valor de cada grupo.
 * Ordena os parceiros pelo total em dívida (maior primeiro) e, dentro de
 * cada parceiro, da comissão mais antiga (mais a "ranger") para a mais
 * recente.
 */
export function groupCommissionsByPartner(
  items: CommissionItem[],
  partnerNameById: Record<string, string>,
): PartnerCommissionGroup[] {
  const byPartner = new Map<string, CommissionItem[]>();
  for (const item of items) {
    const list = byPartner.get(item.partnerId) ?? [];
    list.push(item);
    byPartner.set(item.partnerId, list);
  }

  const groups: PartnerCommissionGroup[] = [];
  for (const [partnerId, list] of byPartner) {
    list.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    groups.push({
      partnerId,
      partnerName: partnerNameById[partnerId] ?? "Parceiro desconhecido",
      items: list,
      total: list.reduce((s, i) => s + (i.amount ?? 0), 0),
    });
  }

  groups.sort((a, b) => b.total - a.total);
  return groups;
}

export function sumCommissions(items: CommissionItem[]): number {
  return items.reduce((s, i) => s + (i.amount ?? 0), 0);
}
