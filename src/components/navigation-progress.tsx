"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type Status = "idle" | "pending" | "completing";

const listeners = new Set<() => void>();

/**
 * Dispara a barra de progresso para navegações programáticas
 * (ex: `router.push(...)` em handlers, depois de await/server actions).
 */
export function startNavigationProgress() {
  for (const l of listeners) l();
}

export function NavigationProgress() {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);

  // Quando o pathname muda, marca a barra como "completing".
  // Padrão "store info from previous renders" para não violar set-state-in-effect.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (status !== "idle") {
      setStatus("completing");
      setProgress(100);
    }
  }

  // Subscreve a clicks em links internos + dispatches programáticos.
  useEffect(() => {
    function start() {
      setStatus((s) => (s === "pending" ? s : "pending"));
      setProgress((p) => (p > 0 ? p : 15));
    }

    function handleClick(e: MouseEvent) {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const link = target?.closest("a") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;

      const rawHref = link.getAttribute("href");
      if (!rawHref) return;
      if (rawHref.startsWith("#")) return;
      if (rawHref.startsWith("mailto:") || rawHref.startsWith("tel:") || rawHref.startsWith("wa.me") || rawHref.startsWith("https:") || rawHref.startsWith("http:")) {
        // Externo ou esquema especial — só conta como navegação interna se for path relativo
        if (!rawHref.startsWith("/")) return;
      }

      let url: URL;
      try {
        url = new URL(rawHref, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return; // mesma página
      }

      start();
    }

    document.addEventListener("click", handleClick, true);
    listeners.add(start);
    return () => {
      document.removeEventListener("click", handleClick, true);
      listeners.delete(start);
    };
  }, []);

  // Anima o progresso enquanto está pendente (assintotica até 90%).
  useEffect(() => {
    if (status !== "pending") return;
    const interval = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.max(1, (90 - p) * 0.12)));
    }, 180);
    return () => clearInterval(interval);
  }, [status]);

  // Depois de completar, esconde após pequeno fade.
  useEffect(() => {
    if (status !== "completing") return;
    const t = setTimeout(() => {
      setStatus("idle");
      setProgress(0);
    }, 280);
    return () => clearTimeout(t);
  }, [status]);

  if (status === "idle") return null;

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-[200] h-[3px] pointer-events-none"
    >
      <div
        className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: status === "completing" ? 0 : 1,
        }}
      />
    </div>
  );
}
