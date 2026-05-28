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

// "Há X min/h/dias/meses/anos" — sempre relativo, nunca cai para data.
// Usado para mostrar a idade de uma tarefa no card do Dashboard.
// Maria pediu para nunca mostrar dd/MM nas tarefas (diferente do "Concluídas
// recentes" onde a data faz mais sentido passado de 7 dias).
export function formatCreatedAgo(iso: string): string {
  const date = parseISO(iso);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `há ${days} dia${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(days / 365);
  return `há ${years} ano${years === 1 ? "" : "s"}`;
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
