"use client";

// ============================================================
// Selo de actividade nas abas Email / WhatsApp
// ============================================================
// A aba que abre por defeito é a do canal preferido do cliente. O
// problema: muita gente escolhe WhatsApp no formulário e depois trocamos
// emails na mesma — e esses emails ficavam escondidos atrás de uma aba
// que ela não tinha razão para abrir.
//
// Cada aba passa a ter um ponto colorido e a data da última mensagem
// desse canal. Âmbar (a piscar) = a última palavra foi do cliente, ou
// seja, está à espera de resposta. Cinzento = a última fomos nós.
// ============================================================

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { calendarDaysFromTodayLisbon } from "@/lib/format-date";

export interface ChannelActivity {
  /** Ainda a carregar: não se mostra selo nenhum. */
  loading: boolean;
  /** Há mensagens neste canal. */
  has: boolean;
  /** Data da última mensagem (ISO). */
  lastAt: string | null;
  /** A última mensagem foi do cliente — está à espera de nós. */
  awaiting: boolean;
}

const VAZIO: ChannelActivity = { loading: false, has: false, lastAt: null, awaiting: false };
const A_CARREGAR: ChannelActivity = { ...VAZIO, loading: true };

/** "hoje", "ontem", "há 5 d", "há 3 sem", "há 4 m". */
export function haQuantoTempo(iso: string | null): string {
  if (!iso) return "";
  const dias = Math.abs(calendarDaysFromTodayLisbon(iso));
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 14) return `há ${dias} d`;
  if (dias < 60) return `há ${Math.round(dias / 7)} sem`;
  return `há ${Math.round(dias / 30)} m`;
}

/** Última mensagem de WhatsApp desta pessoa (uma linha da conversa). */
export function useWhatsappActivity(phone: string | null | undefined): ChannelActivity {
  const tail = (phone ?? "").replace(/\D/g, "").slice(-9);
  const valido = tail.length >= 9;
  // null = ainda não respondeu. O reset faz-se durante o render quando o
  // telefone muda — nunca com setState dentro do effect.
  // [[feedback_react_set_state_in_effect]]
  const [state, setState] = useState<ChannelActivity | null>(null);
  const [prevTail, setPrevTail] = useState(tail);
  if (tail !== prevTail) {
    setPrevTail(tail);
    setState(null);
  }

  useEffect(() => {
    if (tail.length < 9) return;
    let cancelled = false;
    createClient()
      .from("whatsapp_conversations")
      .select("last_message_at, last_message_direction")
      .like("phone_e164", `%${tail}`)
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return;
        const row = (data ?? [])[0] as
          | { last_message_at: string | null; last_message_direction: string | null }
          | undefined;
        if (!row || !row.last_message_at) {
          setState(VAZIO);
          return;
        }
        setState({
          loading: false,
          has: true,
          lastAt: row.last_message_at,
          awaiting: row.last_message_direction === "received",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [tail]);

  return state ?? (valido ? A_CARREGAR : VAZIO);
}

/** Resumo leve do Gmail — 2 chamadas curtas, sem puxar os corpos. */
export function useEmailActivity(email: string | null | undefined): ChannelActivity {
  const valido = !!email && email.includes("@");
  const [state, setState] = useState<ChannelActivity | null>(null);
  const [prevEmail, setPrevEmail] = useState(email);
  if (email !== prevEmail) {
    setPrevEmail(email);
    setState(null);
  }

  useEffect(() => {
    if (!valido || !email) return;
    let cancelled = false;
    fetch(`/api/google/emails/summary?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.status !== "ok" || !data.count) {
          setState(VAZIO);
          return;
        }
        setState({
          loading: false,
          has: true,
          lastAt: data.lastDate ?? null,
          awaiting: data.lastDirection === "received",
        });
      })
      .catch(() => {
        // Google desligado ou offline: a aba fica como sempre esteve.
        if (!cancelled) setState(VAZIO);
      });
    return () => {
      cancelled = true;
    };
  }, [email, valido]);

  return state ?? (valido ? A_CARREGAR : VAZIO);
}

export function ChannelBadge({
  activity,
  tone,
}: {
  activity: ChannelActivity;
  /** Cor de "há mensagens, mas a bola está do nosso lado". */
  tone: "blue" | "green";
}) {
  if (activity.loading || !activity.has) return null;
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-1"
      title={
        activity.awaiting
          ? "A última mensagem foi do cliente"
          : "A última mensagem foi nossa"
      }
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          activity.awaiting
            ? "bg-amber-500 animate-pulse"
            : tone === "blue"
              ? "bg-blue-400"
              : "bg-green-500",
        )}
      />
      <span
        className={cn(
          "text-[9px] tabular-nums",
          activity.awaiting ? "text-amber-700 font-semibold" : "text-cocoa-400",
        )}
      >
        {haQuantoTempo(activity.lastAt)}
      </span>
    </span>
  );
}
