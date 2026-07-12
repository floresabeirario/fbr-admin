"use client";

// Banner "Próxima acção" — uma linha no topo do workbench com a acção
// mais importante derivada de estado + pagamentos + datas (sessão 140).
// Só aparece quando há uma acção concreta; nunca envia nada a clientes
// (regra da casa: a plataforma só lembra). Não duplica os alertas
// dedicados (fatura em falta, aprovação pendente) nem os chips do
// header (Contactada / 40% / 30% — o banner complementa com fraseado
// accionável apenas onde eles não chegam).

import { differenceInCalendarDays, parseISO } from "date-fns";
import { Target } from "lucide-react";
import type { Order } from "@/types/database";

export function computeNextAction(local: Order): { label: string; detail?: string } | null {
  const today = new Date();
  const daysSince = (iso: string) => differenceInCalendarDays(today, parseISO(iso));

  switch (local.status) {
    case "entrega_flores_agendar": {
      const dias = daysSince(local.created_at);
      if (!local.contacted) {
        return {
          label: `Contactar ${local.client_name} para agendar a entrega das flores`,
          detail: `Pré-reserva criada há ${dias} dia${dias === 1 ? "" : "s"}, ainda sem contacto.`,
        };
      }
      return {
        label: "Agendar a entrega das flores",
        detail: "Cliente já contactado — falta combinar a data.",
      };
    }

    case "entrega_agendada": {
      if (local.flower_delivery_method === "recolha_evento" && !local.pickup_date) {
        return { label: "Confirmar data e hora da recolha das flores" };
      }
      if (local.flower_delivery_method === "maos" && !local.hand_delivery_date) {
        return { label: "Combinar o dia da entrega das flores em mãos" };
      }
      if (local.payment_status === "100_por_pagar" && !local.cash_on_delivery) {
        return {
          label: "Pedir o sinal ao cliente",
          detail: "A entrega está agendada mas ainda não há pagamento registado.",
        };
      }
      return null;
    }

    case "flores_enviadas":
      return { label: "Registar a receção quando as flores chegarem" };

    case "flores_recebidas": {
      if (!local.flowers_photo_url) {
        return {
          label: "Fotografar as flores à chegada",
          detail: "Anexar a foto no topo do workbench.",
        };
      }
      return null;
    }

    case "flores_na_prensa":
    case "reconstrucao_botanica": {
      // Congelador: 5 dias anti-insectos já cumpridos e saída por marcar.
      if (local.freezer_in_at && !local.freezer_out_at) {
        const dias = daysSince(local.freezer_in_at);
        if (dias >= 5) {
          return {
            label: "Tirar as flores do congelador",
            detail: `Entraram há ${dias} dias — os 5 dias anti-insectos já passaram.`,
          };
        }
      }
      return null;
    }

    case "quadro_pronto": {
      if (local.payment_status !== "100_pago" && !local.cash_on_delivery) {
        return {
          label: "Pedir o pagamento final antes de enviar o quadro",
          detail: local.payment_30_requested ? "Já pedido — a aguardar o cliente." : undefined,
        };
      }
      if (local.frame_delivery_method === "ctt") {
        return { label: "Enviar o quadro por CTT" };
      }
      if (local.frame_delivery_method === "maos") {
        return { label: "Combinar a entrega do quadro em mãos" };
      }
      return null;
    }

    case "quadro_enviado":
      return {
        label: "Confirmar que o cliente recebeu o quadro",
        detail: local.frame_tracking_code
          ? `Registo CTT ${local.frame_tracking_code}.`
          : undefined,
      };

    case "quadro_recebido": {
      if (local.client_feedback_status === "nao_disse_nada") {
        return { label: "Pedir feedback ao cliente" };
      }
      return null;
    }

    default:
      return null;
  }
}

export function NextActionBanner({ local }: { local: Order }) {
  const action = computeNextAction(local);
  if (!action) return null;
  return (
    <div className="border-b border-cream-200 bg-cream-100/70 dark:bg-cream-100/40 px-3 sm:px-6 py-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
      <span className="inline-flex items-center gap-1.5 font-semibold text-cocoa-900 shrink-0">
        <Target className="h-3.5 w-3.5 text-cocoa-700 self-center" />
        Próxima acção
      </span>
      <span className="text-cocoa-900">{action.label}</span>
      {action.detail && <span className="text-cocoa-600">{action.detail}</span>}
    </div>
  );
}
