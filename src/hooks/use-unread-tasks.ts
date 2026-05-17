"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MinimalTask = {
  id: string;
  title: string;
  assignee_emails: string[];
  seen_by: string[];
  done: boolean;
  deleted_at: string | null;
};

export interface UnreadTasksState {
  count: number;
  tasks: MinimalTask[];
}

// Devolve as tarefas atribuídas ao utilizador actual que ele ainda
// não viu (não estão em seen_by). Usado para a bolinha na sidebar
// e para o toast ao abrir a plataforma. Mesmo padrão que
// useUnreadChatCount (sessão 70).
export function useUnreadTasks(currentEmail: string | null): UnreadTasksState {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<MinimalTask[]>([]);

  useEffect(() => {
    if (!currentEmail) return;
    let cancelled = false;

    supabase
      .from("tasks")
      .select("id, title, assignee_emails, seen_by, done, deleted_at")
      .is("deleted_at", null)
      .eq("done", false)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setTasks(data as MinimalTask[]);
      });

    const channel = supabase
      .channel("tasks-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks" },
        (payload) => {
          const t = payload.new as MinimalTask;
          if (t.deleted_at || t.done) return;
          setTasks((prev) => (prev.some((x) => x.id === t.id) ? prev : [t, ...prev]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks" },
        (payload) => {
          const t = payload.new as MinimalTask;
          setTasks((prev) => {
            if (t.deleted_at || t.done) return prev.filter((x) => x.id !== t.id);
            const exists = prev.some((x) => x.id === t.id);
            if (exists) return prev.map((x) => (x.id === t.id ? t : x));
            return [t, ...prev];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, currentEmail]);

  if (!currentEmail) return { count: 0, tasks: [] };
  const unseen = tasks.filter(
    (t) =>
      t.assignee_emails.includes(currentEmail) &&
      !t.seen_by.includes(currentEmail),
  );
  return { count: unseen.length, tasks: unseen };
}
