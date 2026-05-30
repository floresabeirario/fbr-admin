"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MinimalConversation = {
  id: string;
  unread_count: number;
  archived: boolean;
};

// Soma de unread_count de todas as conversas WhatsApp nao arquivadas.
// Realtime para INSERT/UPDATE.
export function useUnreadWhatsappCount(enabled: boolean): number {
  const supabase = useMemo(() => createClient(), []);
  const [convs, setConvs] = useState<MinimalConversation[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    supabase
      .from("whatsapp_conversations")
      .select("id, unread_count, archived")
      .eq("archived", false)
      .gt("unread_count", 0)
      .limit(1000)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setConvs(data as MinimalConversation[]);
      });

    const channel = supabase
      .channel("unread-whatsapp")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_conversations" },
        (payload) => {
          const c = payload.new as MinimalConversation;
          if (c.archived || c.unread_count <= 0) return;
          setConvs((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_conversations" },
        (payload) => {
          const c = payload.new as MinimalConversation;
          setConvs((prev) => {
            const exists = prev.some((x) => x.id === c.id);
            if (c.archived || c.unread_count <= 0) {
              return exists ? prev.filter((x) => x.id !== c.id) : prev;
            }
            if (exists) return prev.map((x) => (x.id === c.id ? c : x));
            return [c, ...prev];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, enabled]);

  return convs.reduce((acc, c) => acc + (c.unread_count || 0), 0);
}
