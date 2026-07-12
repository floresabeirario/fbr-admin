// ============================================================
// Checklist por fase — itens standard do workbench (sessão 140)
// ============================================================
// Os passos "que vivem na cabeça" de cada fase, por grupo de estados.
// O que está feito por encomenda guarda-se em orders.phase_checklist
// (mig 093): { done: [ids], custom: [{id,label,done}] }.
//
// ⚠️ Labels facilmente afináveis — é editar aqui e fazer deploy.
// Os ids NÃO devem mudar depois de usados (perdia-se o "feito" das
// encomendas antigas).

import type { Order, OrderGroup, OrderStatus, PhaseChecklistState } from "@/types/database";
import { ORDER_GROUPS } from "@/types/database";

export interface ChecklistItemDef {
  id: string;
  label: string;
}

export const PHASE_CHECKLIST: Record<OrderGroup, ChecklistItemDef[]> = {
  pre_reservas: [
    { id: "pre-responder", label: "Responder ao cliente e combinar a entrega das flores" },
    { id: "pre-orcamento", label: "Confirmar o orçamento calculado" },
  ],
  // Mesmo estado que pré-reservas (ghost manual) — mesma checklist.
  sem_resposta: [
    { id: "pre-responder", label: "Responder ao cliente e combinar a entrega das flores" },
    { id: "pre-orcamento", label: "Confirmar o orçamento calculado" },
  ],
  reservas: [
    { id: "res-comprovativo", label: "Anexar comprovativo do sinal" },
    { id: "res-nif", label: "Perguntar se o cliente quer fatura com NIF" },
    { id: "res-morada-devolucao", label: "Confirmar a morada de devolução do quadro" },
    { id: "res-foto", label: "Fotografar as flores à chegada" },
  ],
  preservacao_design: [
    { id: "des-inventario", label: "Registar o inventário das flores" },
    { id: "des-congelador", label: "Passar as flores pelo congelador (5 dias)" },
    { id: "des-status-publico", label: "Actualizar a mensagem do status público" },
  ],
  finalizacao: [
    { id: "fin-comprovativo-final", label: "Anexar comprovativo do pagamento final" },
    { id: "fin-foto-quadro", label: "Fotografar o quadro final" },
    { id: "fin-cupao", label: "Confirmar o cupão 5% e a validade" },
  ],
  concluidos: [
    { id: "con-feedback", label: "Pedir feedback / review ao cliente" },
    { id: "con-drive", label: "Arrumar os ficheiros na pasta Drive do cliente" },
  ],
  cancelamentos: [],
};

/** Grupo visual a que um estado pertence (primeiro grupo que o contém —
 *  "sem_resposta" partilha o estado com "pre_reservas" e nunca ganha). */
export function groupForStatus(status: OrderStatus): OrderGroup {
  const g = ORDER_GROUPS.find((g) => g.statuses.includes(status));
  return g?.id ?? "cancelamentos";
}

/** Itens standard aplicáveis ao estado actual de uma encomenda. */
export function checklistItemsForStatus(status: OrderStatus): ChecklistItemDef[] {
  return PHASE_CHECKLIST[groupForStatus(status)];
}

/** Progresso (feitos/total) dos itens visíveis na fase actual. */
export function checklistProgress(order: Pick<Order, "status" | "phase_checklist">): {
  done: number;
  total: number;
} {
  const state: PhaseChecklistState = order.phase_checklist ?? {};
  const doneIds = new Set(state.done ?? []);
  const standard = checklistItemsForStatus(order.status);
  const custom = state.custom ?? [];
  return {
    done: standard.filter((i) => doneIds.has(i.id)).length + custom.filter((c) => c.done).length,
    total: standard.length + custom.length,
  };
}
