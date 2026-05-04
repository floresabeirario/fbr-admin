// Gerador de códigos de cupão de 5%.
// Regra: alfanuméricos maiúsculos sem `0` (zero) nem `O` (letra) — evita confusão
// quando o cliente lê o código (ex: "OF205Q" vs "0F2O5Q").

const COUPON_CHARS = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789"; // sem 0 nem O

export function generateCouponCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += COUPON_CHARS[Math.floor(Math.random() * COUPON_CHARS.length)];
  }
  return code;
}
