"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Download, Share, Plus, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISSED_KEY = "fbr-pwa-install-dismissed";
const NEVER_SUBSCRIBE = () => () => {};

function useIsStandalone(): boolean {
  return useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {};
      const mql = window.matchMedia("(display-mode: standalone)");
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    () => {
      if (typeof window === "undefined") return false;
      if (window.matchMedia("(display-mode: standalone)").matches) return true;
      const nav = window.navigator as Navigator & { standalone?: boolean };
      return nav.standalone === true;
    },
    () => false,
  );
}

function useIsIOS(): boolean {
  return useSyncExternalStore(
    NEVER_SUBSCRIBE,
    () => {
      if (typeof navigator === "undefined") return false;
      const ua = navigator.userAgent;
      const isIPad = /iPad/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
      return isIPad || /iPhone|iPod/.test(ua);
    },
    () => false,
  );
}

function useInitialDismissed(): boolean {
  return useSyncExternalStore(
    NEVER_SUBSCRIBE,
    () => {
      if (typeof window === "undefined") return false;
      try {
        return window.localStorage.getItem(DISMISSED_KEY) === "1";
      } catch {
        return false;
      }
    },
    () => true,
  );
}

export function InstallPrompt() {
  const isStandalone = useIsStandalone();
  const isIOS = useIsIOS();
  const initialDismissed = useInitialDismissed();

  const [dismissed, setDismissed] = useState(initialDismissed);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handleBeforeInstall(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    function handleInstalled() {
      setDeferredPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.error("[PWA] install prompt failed", err);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore — sessão privada
    }
    setDismissed(true);
  }, []);

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] sm:bottom-4 sm:left-auto sm:right-4 sm:px-0">
      <div className="mx-auto max-w-sm rounded-2xl border border-[#E8E0D5] bg-white shadow-lg dark:border-[#2C2C2E] dark:bg-[#141414] sm:max-w-xs">
        <div className="flex items-start gap-3 p-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#FAF8F5] to-[#E8E0D5] text-[#3D2B1F] dark:from-[#2C2C2E] dark:to-[#1A1A1A] dark:text-[#E8D5B5]">
            <Download className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#3D2B1F] dark:text-[#E8D5B5]">
              Instalar FBR Admin
            </p>
            {deferredPrompt ? (
              <p className="mt-0.5 text-xs leading-relaxed text-[#8B7355] dark:text-[#A8956C]">
                Instala como app no telemóvel para abrir sem o browser.
              </p>
            ) : (
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs leading-relaxed text-[#8B7355] dark:text-[#A8956C]">
                Toca em
                <Share className="inline h-3.5 w-3.5" />
                <span>e depois</span>
                <Plus className="inline h-3.5 w-3.5" />
                <span>&ldquo;Ecrã Principal&rdquo;.</span>
              </p>
            )}
            {deferredPrompt && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#3D2B1F] px-3 text-xs font-medium text-white hover:bg-[#2C1F16] transition-colors dark:bg-[#E8D5B5] dark:text-[#1A1A1A] dark:hover:bg-[#D4C19F]"
              >
                <Download className="h-3.5 w-3.5" />
                Instalar
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dispensar"
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#8B7355] hover:bg-[#FAF8F5] hover:text-[#3D2B1F] dark:text-[#A8956C] dark:hover:bg-[#1F1F1F] dark:hover:text-[#E8D5B5]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
