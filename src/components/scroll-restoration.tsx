"use client";

// ============================================================
// Repor o scroll ao andar para trás/para a frente
// ============================================================
// O browser e o Next só repõem o scroll da JANELA. No admin quem faz
// scroll é o <main> do layout (a janela tem overflow-hidden) e, nas
// listas e workbenches, uma área própria por baixo do cabeçalho fixo.
// Por isso ao voltar atrás a página abria sempre no topo.
//
// Como funciona:
//   • áreas que contam: o <main> (`containerId`) e qualquer elemento com
//     `data-scroll-restore="<nome único>"` lá dentro;
//   • guarda-se o scroll dessas áreas por URL (caminho + query) no momento
//     em que se sai da página: num clique (fase de captura, antes de o
//     Next navegar) e no popstate (antes de o conteúdo mudar);
//   • navegação por "voltar"/"avançar" → repõe as posições guardadas,
//     tentando durante ~2 s enquanto a página ainda não existe ou não tem
//     altura suficiente (loading / dados a carregar);
//   • navegação normal (clicar num link) → não se mexe, fica o
//     comportamento do Next.
// As posições vivem também no sessionStorage, para sobreviverem a um
// F5 ou a sair para outro site e voltar.
// ============================================================

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "fbr-scroll-positions";
const RESTORE_WINDOW_MS = 2000;
const MAIN = "__main__";

type Positions = Map<string, Record<string, number>>;

function currentKey(): string {
  return window.location.pathname + window.location.search;
}

function loadPositions(): Positions {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return new Map(Object.entries(JSON.parse(raw) as Record<string, Record<string, number>>));
  } catch {
    // sessionStorage indisponível (janela privada, etc.) — fica só em memória.
  }
  return new Map();
}

function savePositions(positions: Positions) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(positions)));
  } catch {
    // idem
  }
}

function findArea(containerId: string, name: string): HTMLElement | null {
  const main = document.getElementById(containerId);
  if (name === MAIN) return main;
  return main?.querySelector<HTMLElement>(`[data-scroll-restore="${CSS.escape(name)}"]`) ?? null;
}

export function ScrollRestoration({ containerId }: { containerId: string }) {
  const pathname = usePathname();
  const positionsRef = useRef<Positions | null>(null);
  // URL da página que está à vista (a que se guarda ao sair).
  const shownKeyRef = useRef<string | null>(null);
  // A última navegação foi "voltar"/"avançar"?
  const traversalRef = useRef(false);

  useEffect(() => {
    positionsRef.current = loadPositions();
    shownKeyRef.current = currentKey();

    const snapshot = () => {
      const main = document.getElementById(containerId);
      const key = shownKeyRef.current;
      if (!main || !key || !positionsRef.current) return;
      const areas: Record<string, number> = { [MAIN]: main.scrollTop };
      main.querySelectorAll<HTMLElement>("[data-scroll-restore]").forEach((el) => {
        const name = el.dataset.scrollRestore;
        if (name) areas[name] = el.scrollTop;
      });
      positionsRef.current.set(key, areas);
      savePositions(positionsRef.current);
    };
    const onPopState = () => {
      // O URL já mudou, mas o conteúdo ainda é o da página que se deixa.
      snapshot();
      traversalRef.current = true;
    };

    document.addEventListener("click", snapshot, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pagehide", snapshot);
    return () => {
      document.removeEventListener("click", snapshot, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pagehide", snapshot);
    };
  }, [containerId]);

  useEffect(() => {
    const key = currentKey();
    const isTraversal = traversalRef.current;
    shownKeyRef.current = key;
    traversalRef.current = false;
    if (!isTraversal) return;

    // Sem posição guardada → topo (senão ficava o scroll da página que se deixou).
    const targets = positionsRef.current?.get(key) ?? { [MAIN]: 0 };
    const pending = new Map(Object.entries(targets));

    // A área pode ainda não existir ou não ter altura para chegar à posição
    // (loading, dados a carregar): tenta-se a cada frame até lá chegar ou
    // até o tempo acabar. Se ela fizer scroll entretanto, desiste-se para
    // não lhe roubar o gesto.
    const start = performance.now();
    let frame = 0;
    let userScrolled = false;
    const stop = () => { userScrolled = true; };
    window.addEventListener("wheel", stop, { passive: true, once: true });
    window.addEventListener("touchstart", stop, { passive: true, once: true });
    window.addEventListener("keydown", stop, { once: true });
    const tick = () => {
      if (userScrolled) return;
      for (const [name, top] of pending) {
        const el = findArea(containerId, name);
        if (!el) continue;
        el.scrollTop = top;
        if (Math.abs(el.scrollTop - top) <= 1) pending.delete(name);
      }
      if (pending.size > 0 && performance.now() - start < RESTORE_WINDOW_MS) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
  }, [pathname, containerId]);

  return null;
}
