"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Páginas onde dois utilizadores editam os mesmos dados ao mesmo tempo.
// Mapeia o 1º segmento do caminho → tabelas cujas alterações importam ali.
// Cobre também os workbenches (/preservacao/[id], /parcerias/figura/[id], …)
// porque comparamos só o 1º segmento. Objecto a nível de módulo => referência
// estável (o lookup devolve sempre o mesmo array para o mesmo segmento).
const PATH_TABLES: Record<string, string[]> = {
  preservacao: ["orders"],
  "vale-presente": ["vouchers"],
  parcerias: ["partners", "public_figures"],
};

type ChangedRow = { updated_by?: string | null };

// Devolve { stale, refresh }. `stale` fica true quando OUTRO utilizador altera
// uma das tabelas relevantes para a página actual. As minhas próprias edições
// são ignoradas via updated_by (preenchido pelo trigger set_updated_by, mig 075).
export function useStaleData(): { stale: boolean; refresh: () => void } {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const segment = pathname.split("/")[1] ?? "";
  const tables = PATH_TABLES[segment];

  const [stale, setStale] = useState(false);

  // Guardado em ref (lido só dentro do callback, nunca no render) para a
  // subscrição não precisar de re-subscrever quando o id resolve, e para
  // não haver corrida em que as minhas edições disparam o aviso.
  const myIdRef = useRef<string | null>(null);

  // Limpa o aviso ao navegar para outra página — padrão "store info from
  // previous renders" (evita react-hooks/set-state-in-effect, ver layout).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (stale) setStale(false);
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) myIdRef.current = data.user?.id ?? null;
    });
    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!tables) return;
    let cancelled = false;
    const channel = supabase.channel(`stale-data-${segment}`);
    for (const table of tables) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => {
          if (cancelled) return;
          const row = (payload.new ?? payload.old) as ChangedRow | null;
          // Ignora as minhas próprias edições.
          if (row?.updated_by && row.updated_by === myIdRef.current) return;
          setStale(true);
        },
      );
    }
    channel.subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, segment, tables]);

  function refresh() {
    setStale(false);
    router.refresh();
  }

  return { stale, refresh };
}
