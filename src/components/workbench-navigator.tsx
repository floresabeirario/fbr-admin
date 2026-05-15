"use client";

// ============================================================
// WorkbenchNavigator — setas prev/next dentro de um workbench
// ============================================================
// Encaixa-se no header de um workbench (Preservação, Vale-Presente,
// Parcerias) e dá:
//   - botões ◀ / ▶ clicáveis para slidar entre items
//   - indicador "12 / 47"
//   - atalhos ← / → no teclado (só quando nenhum input/textarea/
//     contenteditable está focado, para não roubar à edição)
//
// A sequência ordenada vem de sessionStorage — gravada pela página
// de listagem quando o utilizador abre um workbench, via
// `setNavList` em `@/lib/workbench-nav`. Se a lista não existir
// (workbench aberto directamente, sem ter passado pela listagem),
// o componente devolve `null` e desaparece.
// ============================================================

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { startNavigationProgress } from "@/components/navigation-progress";
import { getNavContext, type WorkbenchNavKey, type NavContext } from "@/lib/workbench-nav";

interface Props {
  navKey: WorkbenchNavKey;
  currentId: string;
  basePath: string; // ex: "/preservacao", "/vale-presente", "/parcerias"
}

// Cache módulo-local para o snapshot: `useSyncExternalStore` compara
// resultados de `getSnapshot` com `Object.is`. Se devolvermos objectos
// novos em cada chamada (como `getNavContext` faz), o React detecta
// "mudança" todo o render e entra em loop infinito → React error #185.
// Só há um workbench montado de cada vez, por isso um slot único chega.
let snapshotCache: { key: string; value: NavContext | null } = {
  key: "__empty__",
  value: null,
};

function getCachedSnapshot(
  navKey: WorkbenchNavKey,
  currentId: string,
): NavContext | null {
  const key = `${navKey}:${currentId}`;
  if (snapshotCache.key !== key) {
    snapshotCache = { key, value: getNavContext(navKey, currentId) };
  }
  return snapshotCache.value;
}

const noopSubscribe = () => () => {};
const ssrSnapshot = (): NavContext | null => null;

export default function WorkbenchNavigator({ navKey, currentId, basePath }: Props) {
  const router = useRouter();

  const getSnapshot = useCallback(
    () => getCachedSnapshot(navKey, currentId),
    [navKey, currentId],
  );
  const ctx = useSyncExternalStore<NavContext | null>(
    noopSubscribe,
    getSnapshot,
    ssrSnapshot,
  );

  // Atalhos teclado. Para evitar closure stale, lemos o contexto
  // directamente do sessionStorage dentro do handler em vez de capturar
  // o `ctx` actual — sessionStorage é estável durante a vida do
  // componente, mas isto torna o handler robusto a re-renders.
  useEffect(() => {
    function isEditableTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (t.isContentEditable) return true;
      return false;
    }
    function onKeyDown(e: KeyboardEvent) {
      const c = getNavContext(navKey, currentId);
      if (!c) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key === "ArrowLeft" && c.prev) {
        e.preventDefault();
        startNavigationProgress();
        router.push(`${basePath}/${c.prev}`);
      } else if (e.key === "ArrowRight" && c.next) {
        e.preventDefault();
        startNavigationProgress();
        router.push(`${basePath}/${c.next}`);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [basePath, router, navKey, currentId]);

  function navigate(targetId: string) {
    startNavigationProgress();
    router.push(`${basePath}/${targetId}`);
  }

  if (!ctx) return null;

  const btnCls =
    "inline-flex items-center justify-center h-7 w-7 rounded-md border border-cream-200 bg-surface text-cocoa-700 hover:bg-cream-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex items-center gap-1 shrink-0" aria-label="Navegação entre items">
      <button
        type="button"
        onClick={() => ctx.prev && navigate(ctx.prev)}
        disabled={!ctx.prev}
        className={btnCls}
        title="Anterior (←)"
        aria-label="Anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="font-mono text-[10px] text-cocoa-500 tabular-nums px-1 select-none">
        {ctx.index + 1} / {ctx.total}
      </span>
      <button
        type="button"
        onClick={() => ctx.next && navigate(ctx.next)}
        disabled={!ctx.next}
        className={btnCls}
        title="Próximo (→)"
        aria-label="Próximo"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
