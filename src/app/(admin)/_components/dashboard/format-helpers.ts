// Helpers de formatação usados pelos cards do Dashboard.
// Datas em pt; relativos em PT ("Hoje", "Em 3 dias", "há 5 min").

import { format, parseISO, differenceInDays } from "date-fns";
import { pt } from "date-fns/locale";

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd/MM/yyyy", { locale: pt });
  } catch {
    return "—";
  }
}

export function formatRelativeDays(d: string): string {
  const days = differenceInDays(parseISO(d), new Date());
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days === -1) return "Ontem";
  if (days > 0) return `Em ${days} dias`;
  return `Há ${Math.abs(days)} dias`;
}

// "Há X min/h/d" para a secção "Concluídas recentes". Salta para "dd/MM"
// quando passa de 7 dias para evitar valores enormes.
export function formatDoneAgo(iso: string): string {
  const date = parseISO(iso);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return format(date, "dd/MM", { locale: pt });
}
