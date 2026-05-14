import type { Voucher, VoucherPaymentStatus } from "@/types/voucher";

// Ordena por data de criação descendente (mais recentes primeiro)
function byCreatedAtDesc(a: Voucher, b: Voucher): number {
  return b.created_at.localeCompare(a.created_at);
}

// ── Single source of truth: estado de pagamento → grupo ───────
// Mesma protecção que existe nas encomendas: `Record<VoucherPaymentStatus, …>`
// força o TypeScript a falhar se algum dia for adicionado um estado novo
// e esquecido aqui. Não substituir por Partial nem por filtros soltos:
// é a salvaguarda contra vales que "desaparecem" da Tabela.
export type VoucherGroupKey = "pre_reservas" | "reservas";

const PAYMENT_TO_GROUP: Record<VoucherPaymentStatus, VoucherGroupKey> = {
  "100_por_pagar": "pre_reservas",
  "100_pago":      "reservas",
};

// Agrupa vales para a vista de tabela. Devolve também `orfas` (vales
// com estado desconhecido vindo da BD) para nunca os esconder
// silenciosamente — mesma rede de segurança das encomendas.
export function groupVouchers(
  vouchers: Voucher[],
): Record<VoucherGroupKey, Voucher[]> & { orfas: Voucher[] } {
  const sorted = [...vouchers].sort(byCreatedAtDesc);

  const buckets: Record<VoucherGroupKey, Voucher[]> & { orfas: Voucher[] } = {
    pre_reservas: [],
    reservas: [],
    orfas: [],
  };

  for (const v of sorted) {
    const group = PAYMENT_TO_GROUP[v.payment_status];
    if (!group) {
      buckets.orfas.push(v);
      if (typeof window !== "undefined" && typeof console !== "undefined") {
        console.error(
          `[vouchers] Vale ${v.code} tem estado de pagamento desconhecido "${v.payment_status}". ` +
            `Adicione um mapeamento em PAYMENT_TO_GROUP.`,
        );
      }
      continue;
    }
    buckets[group].push(v);
  }

  return buckets;
}

// Quantos meses faltam até expirar
export function monthsUntilExpiry(expiry: string): number {
  const today = new Date();
  const exp = new Date(expiry);
  const months =
    (exp.getFullYear() - today.getFullYear()) * 12 +
    (exp.getMonth() - today.getMonth());
  return months;
}

// Está próximo de expirar (<= 3 meses)?
export function isExpiringSoon(expiry: string): boolean {
  const months = monthsUntilExpiry(expiry);
  return months >= 0 && months <= 3;
}

// Já expirou?
export function isExpired(expiry: string): boolean {
  return new Date(expiry) < new Date();
}
