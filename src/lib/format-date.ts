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

const lisbonDateTimeSeconds = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const lisbonTime = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
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

/** "dd/MM/aaaa, HH:mm:ss" na hora de Portugal (ex.: audit log). */
export function formatDateTimeLisbonWithSeconds(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return lisbonDateTimeSeconds.format(d);
}

/** "HH:mm" na hora de Portugal (ex.: bolhas de chat). "" se inválido. */
export function formatTimeLisbon(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return lisbonTime.format(d);
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
  // "Hoje" é o dia em LISBOA, não o da máquina: entre a meia-noite de cá
  // e a de Londres o servidor (UTC) ainda está no dia anterior e diria
  // "Em 3 dias" onde o browser diz "Em 2 dias" → mismatch de hidratação.
  const today = new Date(`${lisbonDayKey(new Date())}T00:00:00Z`);
  target = new Date(`${lisbonDayKey(target)}T00:00:00Z`);

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

// ── Dia de calendário em Lisboa ───────────────────────────────
// Tudo o que compara datas ("Hoje", "Ontem", "há 3 dias") tem de usar o
// calendário de LISBOA, não o da máquina: no servidor Vercel (UTC) o dia
// muda uma hora antes do que muda cá, por isso entre a meia-noite de
// Lisboa e a de Londres o servidor e o browser discordam sobre que dia é
// hoje — e o React deita a árvore fora (mismatch de hidratação, #418).
const lisbonDayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Lisbon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "aaaa-MM-dd" do dia em que este instante cai, em Lisboa. */
export function lisbonDayKey(date: Date): string {
  return lisbonDayKeyFmt.format(date);
}

/**
 * Dias de calendário (em Lisboa) entre hoje e `iso`. Positivo = futuro.
 * Aceita colunas DATE ("2026-08-27") e timestamptz — uma DATE vem como
 * meia-noite UTC, que em Lisboa cai sempre no mesmo dia.
 */
export function calendarDaysFromTodayLisbon(iso: string): number {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return 0;
  const a = Date.parse(`${lisbonDayKey(target)}T00:00:00Z`);
  const b = Date.parse(`${lisbonDayKey(new Date())}T00:00:00Z`);
  return Math.round((a - b) / 86_400_000);
}

const lisbonDate = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const lisbonDayMonth = new Intl.DateTimeFormat("pt-PT", {
  timeZone: "Europe/Lisbon",
  day: "2-digit",
  month: "2-digit",
});

/** "dd/MM/aaaa" a partir de um instante (timestamptz), na hora de Lisboa. */
export function formatDateLisbon(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return lisbonDate.format(d);
}

/** "dd/MM" a partir de um instante (timestamptz), na hora de Lisboa. */
export function formatDayMonthLisbon(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return lisbonDayMonth.format(d);
}

/**
 * Date cujo getHours()/getMinutes() devolvem a hora de parede de Lisboa.
 * Para código que só sabe ler `now.getHours()` (ex.: saudacaoPorHora)
 * mas corre no servidor, que está em UTC: sem isto, às 19h30 em Lisboa
 * (18h30 UTC) saía "Boa tarde" em vez de "Boa noite".
 */
export function lisbonWallClock(d: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
}
