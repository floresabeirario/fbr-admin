import "server-only";
import { timingSafeEqual } from "node:crypto";

// Autorização partilhada dos endpoints de cron (backup, healthcheck,
// reminders). O Vercel Cron envia `Authorization: Bearer <CRON_SECRET>`
// automaticamente em produção; o GitHub Actions dos lembretes faz o mesmo.
//
// Em desenvolvimento sem CRON_SECRET, deixa correr à mão (devolve true).
// Em produção sem CRON_SECRET, rejeita — um cron sem segredo é um endpoint
// aberto.
//
// A comparação é em tempo constante (timingSafeEqual) para não vazar o
// comprimento/prefixo do segredo por timing — alinhado com as rotas
// internas (notify-order/notify-voucher).
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  if (!secret) return !isProd;

  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  // timingSafeEqual exige buffers do mesmo tamanho; comprimentos diferentes
  // não são segredo (o header é enviado pelo cliente), por isso saímos já.
  if (auth.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
  } catch {
    return false;
  }
}
