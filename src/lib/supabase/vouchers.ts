import type { Voucher } from "@/types/voucher";

// Ordena por data de criação descendente (mais recentes primeiro)
function byCreatedAtDesc(a: Voucher, b: Voucher): number {
  return b.created_at.localeCompare(a.created_at);
}

// Agrupa vales para a vista de tabela:
// - Pré-reservas: 100% por pagar
// - Reservas:     100% pago
export function groupVouchers(vouchers: Voucher[]) {
  const sorted = [...vouchers].sort(byCreatedAtDesc);
  return {
    pre_reservas: sorted.filter((v) => v.payment_status === "100_por_pagar"),
    reservas:     sorted.filter((v) => v.payment_status === "100_pago"),
  };
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
