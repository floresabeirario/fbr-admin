"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MinimalChatMessage = {
  id: string;
  author_email: string;
  read_by: string[];
  deleted_at: string | null;
};

export function useUnreadChatCount(currentEmail: string | null): number {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<MinimalChatMessage[]>([]);

  useEffect(() => {
    if (!currentEmail) return;
    let cancelled = false;

    supabase
      .from("chat_messages")
      .select("id, author_email, read_by, deleted_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setMessages(data as MinimalChatMessage[]);
      });

    const channel = supabase
      .channel("chat-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const m = payload.new as MinimalChatMessage;
          if (m.deleted_at) return;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages" },
        (payload) => {
          const m = payload.new as MinimalChatMessage;
          setMessages((prev) =>
            m.deleted_at
              ? prev.filter((x) => x.id !== m.id)
              : prev.map((x) => (x.id === m.id ? m : x)),
          );
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, currentEmail]);

  if (!currentEmail) return 0;
  return messages.reduce((acc, m) => {
    if (m.author_email === currentEmail) return acc;
    if (m.read_by.includes(currentEmail)) return acc;
    return acc + 1;
  }, 0);
}
