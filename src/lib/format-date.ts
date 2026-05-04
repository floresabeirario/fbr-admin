import { differenceInCalendarDays, differenceInCalendarMonths, parseISO } from "date-fns";

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
