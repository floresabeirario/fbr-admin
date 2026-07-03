import { differenceInCalendarDays, differenceInCalendarMonths, parseISO } from "date-fns";

// Formatador de instantes (timestamptz) FIXO na hora de Portugal
// continental. Sem timeZone fixo, `format`/`toLocale…` imprimem na hora
// da máquina: o servidor Vercel corre em UTC e o browser em Europe/Lisbon
// (UTC+1 no verão) → o HH:mm desfasa 1h entre SSR e cliente e o React
// deita a árvore fora (mismatch de hidratação, error #418). Formatar
// sempre em Lisboa dá o mesmo texto dos dois lados E é a hora certa para nós.
const lisbonDateTime = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * "dd/MM/aaaa" a partir de uma data-só (coluna DATE, ex.: "2026-07-04").
 * Reordena os componentes da string — sem `new Date()` — por isso não há
 * risco de desvio de fuso (uma DATE não tem hora). Aceita ISO completo,
 * usando apenas a parte da data.
 */
export function formatDatePT(date: string | null | undefined): string {
  if (!date) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return date;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** "dd/MM/aaaa, HH:mm" na hora de Portugal — consistente SSR↔browser. */
export function formatDateTimeLisbon(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return lisbonDateTime.format(d);
}

/**
 * Distância humana até/desde uma data, em meses+dias.
 * Ex: "Em 2 meses e 3 dias", "Há 1 mês e 5 dias", "Hoje", "Amanhã".
 */
export function relativeMonthsDays(targetDateIso: string): string {
  let target: Date;
  try {
    target = parseISO(targetDateIso);
  } catch {
    return "—";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = differenceInCalendarDays(target, today);
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days === -1) return "Ontem";

  const future = days > 0;
  // Para o cálculo dos componentes, trabalhamos com valor absoluto.
  const absTarget = future ? target : today;
  const absStart  = future ? today  : target;

  const totalMonths = differenceInCalendarMonths(absTarget, absStart);
  // dias que restam depois de tirar `totalMonths` meses inteiros
  const monthsAhead = new Date(absStart);
  monthsAhead.setMonth(monthsAhead.getMonth() + totalMonths);
  const remainingDays = differenceInCalendarDays(absTarget, monthsAhead);

  const parts: string[] = [];
  if (totalMonths > 0) {
    parts.push(`${totalMonths} ${totalMonths === 1 ? "mês" : "meses"}`);
  }
  if (remainingDays > 0) {
    parts.push(`${remainingDays} ${remainingDays === 1 ? "dia" : "dias"}`);
  }
  if (parts.length === 0) parts.push(`${Math.abs(days)} dias`);

  const phrase = parts.join(" e ");
  return future ? `Em ${phrase}` : `Há ${phrase}`;
}
