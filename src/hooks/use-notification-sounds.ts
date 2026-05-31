"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem("fbr-notif-sound") === "off";
}

export function toggleNotificationSound(): boolean {
  if (typeof window === "undefined") return false;
  const cur = isMuted();
  window.localStorage.setItem("fbr-notif-sound", cur ? "on" : "off");
  return cur; // true = passou a ON
}

export function isNotificationSoundOn(): boolean {
  if (typeof window === "undefined") return false;
  return !isMuted();
}

// Tom curto gerado via Web Audio API. Evita ter ficheiro estatico.
// Padrao "pop" subtil: A5 (880Hz) decay rapido. Volume baixo.
function playPop(opts?: { frequency?: number; volume?: number }) {
  if (isMuted()) return;
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = opts?.frequency ?? 880;
    osc.type = "sine";
    const vol = opts?.volume ?? 0.15;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    // Fechar contexto apos terminar (libertar recursos)
    setTimeout(() => {
      try {
        void ctx.close();
      } catch {}
    }, 300);
  } catch {
    // Browsers podem bloquear autoplay ate haver interacao do utilizador
  }
}

// Subscribe ao Realtime e toca som em INSERTs relevantes.
// Mounted uma vez no admin layout.
export function useNotificationSounds(currentEmail: string | null) {
  const supabase = useMemo(() => createClient(), []);
  // Apanha startedAt para nao tocar para mensagens muito velhas que
  // cheguem em retransmissoes ou na carga inicial do Realtime.
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!currentEmail) return;
    const channel = supabase
      .channel("fbr-notif-sounds")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          const m = payload.new as {
            direction: "received" | "sent_echo";
            received_at: string;
          };
          if (m.direction !== "received") return;
          const receivedTs = new Date(m.received_at).getTime();
          if (receivedTs < startedAtRef.current - 60_000) return; // ignorar atrasos > 1min
          // Tom mais agudo para WhatsApp (cliente)
          playPop({ frequency: 880, volume: 0.12 });
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const o = payload.new as { created_at?: string };
          if (o.created_at) {
            const ts = new Date(o.created_at).getTime();
            if (ts < startedAtRef.current - 60_000) return;
          }
          // Tom mais grave para encomenda nova (distinguir)
          playPop({ frequency: 660, volume: 0.18 });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, currentEmail]);
}
