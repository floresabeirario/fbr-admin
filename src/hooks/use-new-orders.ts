"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MinimalOrder = {
  id: string;
  seen_by: string[];
  deleted_at: string | null;
};

// Devolve o nº de encomendas que o utilizador actual ainda não abriu
// pelo menos uma vez (não está em seen_by[]). Usado para a bolinha na
// sidebar ao lado de "Preservação de Flores". Mesmo padrão que
// useUnreadTasks (sessão 75) + tasks.seen_by (mig 044).
//
// Per-user: cada admin/viewer tem o seu próprio estado de "lida"; abrir
// o workbench da encomenda esconde a notificação só para esse user.
export function useUnreadOrdersCount(currentEmail: string | null): number {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<MinimalOrder[]>([]);

  useEffect(() => {
    if (!currentEmail) return;
    let cancelled = false;

    supabase
      .from("orders")
      .select("id, seen_by, deleted_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setOrders(data as MinimalOrder[]);
      });

    const channel = supabase
      .channel("orders-unread-count")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const o = payload.new as MinimalOrder;
          if (o.deleted_at) return;
          setOrders((prev) => (prev.some((x) => x.id === o.id) ? prev : [o, ...prev]));
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const o = payload.new as MinimalOrder;
          setOrders((prev) => {
            if (o.deleted_at) return prev.filter((x) => x.id !== o.id);
            const exists = prev.some((x) => x.id === o.id);
            if (exists) return prev.map((x) => (x.id === o.id ? o : x));
            return [o, ...prev];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, currentEmail]);

  if (!currentEmail) return 0;
  return orders.filter((o) => !o.seen_by?.includes(currentEmail)).length;
}
