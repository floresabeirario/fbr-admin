"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  savePushSubscriptionAction,
  deletePushSubscriptionAction,
} from "@/app/(admin)/push-actions";

// Botão de ligar/desligar as notificações push NESTE dispositivo. Cada
// pessoa activa no seu telemóvel; o estado vive no browser (a subscrição do
// PushManager), não em localStorage. Mostra:
//   • sino aberto  → notificações desligadas (clica para ligar)
//   • sino a tocar → notificações ligadas (clica para desligar)
//   • sino cortado → não suportado / permissão bloqueada (desactivado)

type State = "loading" | "unsupported" | "off" | "on" | "blocked";

// A chave pública VAPID (base64url) tem de ir para o subscribe como bytes.
// Aloca sobre um ArrayBuffer explícito para o tipo bater certo com o
// applicationServerKey (BufferSource) sem casts.
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function PushToggle({ className }: { className?: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  // Descobre o estado actual ao montar: há subscrição activa neste browser?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isSupported()) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("blocked");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (!cancelled) setState(sub ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapid) {
      toast.error("Notificações ainda não configuradas (falta a chave VAPID).");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        if (permission === "denied") {
          toast.error("Notificações bloqueadas nas definições do browser.");
        }
        return;
      }
      // Em dev o service worker não é registado (só em produção), por isso
      // `ready` podia ficar pendurado — usamos getRegistration com aviso.
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        toast.error("Service worker não disponível (só funciona na app instalada / produção).");
        setState("off");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
      const json = sub.toJSON();
      const keys = json.keys ?? {};
      if (!json.endpoint || !keys.p256dh || !keys.auth) {
        throw new Error("subscrição incompleta");
      }
      await savePushSubscriptionAction({
        endpoint: json.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: navigator.userAgent,
      });
      setState("on");
      toast.success("Notificações ligadas neste dispositivo.");
    } catch (err) {
      console.error("[push] enable falhou", err);
      toast.error("Não foi possível ligar as notificações.");
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe().catch(() => {});
        await deletePushSubscriptionAction(endpoint);
      }
      setState("off");
      toast.success("Notificações desligadas neste dispositivo.");
    } catch (err) {
      console.error("[push] disable falhou", err);
      toast.error("Não foi possível desligar as notificações.");
    } finally {
      setBusy(false);
    }
  }

  // Não renderizar nada enquanto sonda / se não for suportado: evita um
  // botão morto na sidebar (ex.: iOS Safari sem PWA instalada).
  if (state === "loading" || state === "unsupported") return null;

  const Icon = state === "on" ? BellRing : state === "blocked" ? BellOff : Bell;
  const title =
    state === "on"
      ? "Desligar notificações neste dispositivo"
      : state === "blocked"
        ? "Notificações bloqueadas nas definições do browser"
        : "Ligar notificações neste dispositivo";

  return (
    <button
      type="button"
      onClick={state === "on" ? disable : state === "blocked" ? undefined : enable}
      disabled={busy || state === "blocked"}
      className={cn(
        "flex items-center justify-center rounded-lg p-2 transition-colors",
        state === "on"
          ? "text-emerald-600 hover:bg-cream-50"
          : "text-cocoa-500 hover:bg-cream-50 hover:text-cocoa-900",
        (busy || state === "blocked") && "opacity-60",
        className,
      )}
      title={title}
      aria-label={title}
    >
      <Icon className={cn("h-4 w-4", state === "blocked" && "text-cocoa-400")} />
    </button>
  );
}
