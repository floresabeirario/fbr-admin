"use client";

import { RefreshCw } from "lucide-react";
import { useStaleData } from "@/hooks/use-stale-data";

// Aviso discreto que aparece quando OUTRO utilizador altera dados da página em
// que estás (Preservação / Vale-Presente / Parcerias). Clicar actualiza a
// página. Não interrompe o que estás a fazer — só avisa, e tu decides quando
// actualizar (importante se estiveres a meio de uma edição). Ignora as tuas
// próprias edições (ver use-stale-data + trigger set_updated_by, mig 075).
export function StaleDataBanner() {
  const { stale, refresh } = useStaleData();
  if (!stale) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4 lg:top-4">
      <button
        type="button"
        onClick={refresh}
        aria-live="polite"
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 shadow-lg shadow-amber-900/10 transition-colors hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-950/90 dark:text-amber-200 dark:hover:bg-amber-900/80"
      >
        <RefreshCw className="h-4 w-4 shrink-0" />
        Há alterações novas — clica para atualizar
      </button>
    </div>
  );
}
