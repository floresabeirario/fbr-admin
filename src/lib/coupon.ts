// Gerador de códigos de cupão de 5%.
// Regra: alfanuméricos maiúsculos sem `0` (zero) nem `O` (letra) — evita confusão
// quando o cliente lê o código (ex: "OF205Q" vs "0F2O5Q").

import type { SupabaseClient } from "@supabase/supabase-js";

const COUPON_CHARS = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789"; // sem 0 nem O

export function generateCouponCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += COUPON_CHARS[Math.floor(Math.random() * COUPON_CHARS.length)];
  }
  return code;
}

/**
 * Gera um código de cupão único — verifica contra `orders.coupon_code`
 * (que é UNIQUE) e tenta até `maxAttempts` vezes em caso de colisão.
 *
 * Com 6 chars × 34 valores possíveis há ~1.5B combinações; colisões são
 * raras mas crescem com o tamanho da tabela (problema do aniversário).
 * Sem este retry, o INSERT/UPDATE rebenta com `duplicate key (23505)`.
 *
 * Lança erro se esgotar tentativas — caller (server action) deve mostrar
 * mensagem ao utilizador para tentar de novo.
 */
export async function generateUniqueCouponCode(
  supabase: SupabaseClient,
  maxAttempts = 5,
  length = 6,
): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = generateCouponCode(length);
    const { data, error } = await supabase
      .from("orders")
      .select("id")
      .eq("coupon_code", code)
      .limit(1)
      .maybeSingle();
    if (error && error.code !== "PGRST116") {
      // PGRST116 = "no rows" — qualquer outro erro é problema real.
      throw new Error("Erro ao validar cupão: " + error.message);
    }
    if (!data) return code; // livre!
  }
  throw new Error(
    `Não foi possível gerar um cupão único após ${maxAttempts} tentativas. Tenta de novo.`,
  );
}
