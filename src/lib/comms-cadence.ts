// ============================================================
// Motor de cadência de comunicação
// ============================================================
// A FBR comunica com os clientes à mão (WhatsApp). Para não esquecer
// nenhuma mensagem importante, cada "momento" da vida de uma encomenda
// pode gerar uma TAREFA-lembrete nos Afazeres do Dashboard ("lista de
// mensagens por enviar") que a Maria vai dando check. NADA é enviado
// automaticamente — a tarefa só lembra e aponta para o template certo.
//
// Este módulo é PURO (sem IO): declara os momentos e decide quais
// dispararam numa transição. A criação efectiva da tarefa acontece em
// `updateOrderAction` (src/app/(admin)/preservacao/actions.ts), no mesmo
// sítio onde já detectamos transições (1º pagamento, cancelamento, etc).
//
// Para acrescentar um momento no futuro: +1 entrada em COMMS_CADENCE
// (e o(s) template(s) PT/EN correspondentes). Sem mais lógica.
// ============================================================

import type { OrderStatus, PaymentStatus } from "@/types/database";
import type { TaskCategory, TaskPriority } from "@/types/tasks";
import { ADMIN_EMAILS_LIST } from "@/lib/auth/roles";

export interface CommsMoment {
  /** Chave única e estável — guardada em orders.comms_moments_done. */
  key: string;
  /** Descrição curta (para nós, devs / futura UI). */
  label: string;
  /** Dispara quando a encomenda ENTRA neste estado. */
  triggerStatus?: OrderStatus;
  /** Dispara quando a encomenda ENTRA neste estado de pagamento. */
  triggerPayment?: PaymentStatus;
  /** Slug base do template a usar (o picker tem variantes _pt/_en). */
  templateSlug: string;
  /** Título da tarefa-lembrete, com o nome do cliente. */
  taskTitle: (clientName: string | null) => string;
  category: TaskCategory;
  priority: TaskPriority;
  /** Dias até ao prazo da tarefa, a contar do momento da transição. */
  dueOffsetDays: number;
  /** Emails a quem a tarefa fica atribuída. */
  assignees: readonly string[];
}

// ── A cadência ──────────────────────────────────────────────
// Por agora só o momento "pedir opinião". Os restantes momentos
// (pedir sinal, confirmar reserva, pedir parcelas, avisar envio)
// ficam para uma sessão futura — acrescentam-se aqui.
export const COMMS_CADENCE: CommsMoment[] = [
  {
    key: "pedir_opiniao",
    label: "Pedir opinião 2 dias após o quadro ser recebido",
    triggerStatus: "quadro_recebido",
    templateSlug: "pedir_opiniao_quadro",
    taskTitle: (name) =>
      `Pedir opinião sobre o quadro — ${name?.trim() || "cliente"} (WhatsApp)`,
    category: "outros",
    priority: "media",
    dueOffsetDays: 2,
    assignees: ADMIN_EMAILS_LIST,
  },
];

export interface CadenceTransition {
  prevStatus?: OrderStatus | null;
  nextStatus?: OrderStatus | null;
  prevPayment?: PaymentStatus | null;
  nextPayment?: PaymentStatus | null;
  /** Momentos já gerados para esta encomenda (orders.comms_moments_done). */
  alreadyDone: readonly string[];
}

/**
 * Devolve os momentos da cadência cujo gatilho disparou nesta transição
 * e que ainda não tinham sido gerados (idempotência). Um momento dispara
 * quando a encomenda ENTRA no estado/pagamento-alvo (o valor mudou para
 * o alvo nesta operação) — não dispara se já lá estava.
 */
export function detectTriggeredMoments(t: CadenceTransition): CommsMoment[] {
  const done = new Set(t.alreadyDone);
  return COMMS_CADENCE.filter((m) => {
    if (done.has(m.key)) return false;

    if (m.triggerStatus !== undefined) {
      const entered =
        t.nextStatus === m.triggerStatus && t.prevStatus !== m.triggerStatus;
      if (!entered) return false;
    }
    if (m.triggerPayment !== undefined) {
      const entered =
        t.nextPayment === m.triggerPayment &&
        t.prevPayment !== m.triggerPayment;
      if (!entered) return false;
    }
    // Pelo menos um gatilho tem de estar definido (todos os momentos têm).
    return m.triggerStatus !== undefined || m.triggerPayment !== undefined;
  });
}

/**
 * Calcula a data de prazo (yyyy-MM-dd) a partir de um offset de dias.
 * Usa a data local — o prazo é uma data civil, não um instante.
 */
export function dueDateFromOffset(offsetDays: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
