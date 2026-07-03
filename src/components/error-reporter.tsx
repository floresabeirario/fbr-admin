"use client";

// ============================================================
// Captura global de erros JS no browser (mig 086).
// ============================================================
// Montado uma vez no layout do grupo (admin). Ouve window.onerror e
// unhandledrejection e regista na tabela client_errors via server
// action. Sem UI — o utilizador não vê nada; os admins veem a
// contagem no healthcheck ("Erros na app nas últimas 24h").
//
// Salvaguardas: máx. 5 relatórios por carregamento de página (um loop
// de erros não inunda a BD) e nunca repete a mesma mensagem seguida.

import { useEffect, useRef } from "react";
import { reportClientErrorAction } from "@/app/(admin)/actions";

const MAX_REPORTS_PER_PAGELOAD = 5;

export function ErrorReporter() {
  const sentCount = useRef(0);
  const lastMessage = useRef<string | null>(null);

  useEffect(() => {
    function send(message: string, stack: string | null) {
      if (sentCount.current >= MAX_REPORTS_PER_PAGELOAD) return;
      if (message === lastMessage.current) return;
      sentCount.current += 1;
      lastMessage.current = message;
      // fire-and-forget; a action engole falhas de propósito
      void reportClientErrorAction({
        message,
        stack,
        path: window.location.pathname,
        source: "client",
      });
    }

    function onError(event: ErrorEvent) {
      // "Script error." = erro cross-origin sem detalhe — inútil registar
      if (!event.message || event.message === "Script error.") return;
      send(event.message, event.error?.stack ?? null);
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? `Unhandled rejection: ${reason.message}`
          : `Unhandled rejection: ${String(reason).slice(0, 300)}`;
      send(message, reason instanceof Error ? (reason.stack ?? null) : null);
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
