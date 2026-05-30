"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MinimalTask = {
  id: string;
  assignee_emails: string[];
  done: boolean;
  deleted_at: string | null;
};

// Total de tarefas activas (done=false, não apagadas) atribuídas ao
// utilizador actual. Diferente de `useUnreadTasks` (sessão 75) que só conta
// tarefas que ainda não vi (notificação). Esta é uma contagem persistente
// — só vai a 0 quando todas as minhas tarefas estão fechadas.
export function useMyActiveTasksCount(currentEmail: string | null): number {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<MinimalTask[]>([]);

  useEffect(() => {
    if (!currentEmail) return;
    let cancelled = false;

    supabase
      .from("tasks")
      .select("id, assignee_emails, done, deleted_at")
      .is("deleted_at", null)
      .eq("done", false)
      .limit(1000)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setTasks(data as MinimalTask[]);
      });

    const channel = supabase
      .channel("my-active-tasks")
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
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "tasks" },
        (payload) => {
          const t = payload.old as MinimalTask;
          setTasks((prev) => prev.filter((x) => x.id !== t.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, currentEmail]);

  if (!currentEmail) return 0;
  return tasks.filter((t) => t.assignee_emails.includes(currentEmail)).length;
}
