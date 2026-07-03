"use client";

// ============================================================
// Error boundary do grupo (admin) — em vez do ecrã branco do Next,
// mostra uma mensagem com botão de retry e regista o erro na tabela
// client_errors (mig 086) para os admins verem no healthcheck.
// ============================================================

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { reportClientErrorAction } from "./actions";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportClientErrorAction({
      message: error.message || "Erro sem mensagem (error boundary)",
      stack: error.stack ?? (error.digest ? `digest: ${error.digest}` : null),
      path: typeof window !== "undefined" ? window.location.pathname : null,
      source: "boundary",
    });
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
      <p className="text-4xl">🥀</p>
      <h1 className="text-lg font-semibold text-cocoa-900">
        Algo correu mal nesta página
      </h1>
      <p className="text-sm text-cocoa-500 max-w-md">
        O erro ficou registado e vai aparecer nos Healthchecks. Tenta
        recarregar; se voltar a acontecer, avisa no chat da equipa com o
        que estavas a fazer.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-btn-primary text-btn-primary-fg text-sm font-medium hover:bg-btn-primary-hover transition-colors"
      >
        <RotateCw className="h-4 w-4" />
        Tentar novamente
      </button>
    </div>
  );
}
