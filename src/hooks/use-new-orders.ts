"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MinimalOrder = {
  id: string;
  created_at: string;
  deleted_at: string | null;
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Devolve o número de encomendas criadas nas últimas 24h (alinhado com a
// heurística do badge "Nova" da tabela/cards). Mostra-se como bolinha
// na sidebar ao lado de "Preservação de Flores" — esconde sozinha ao
// fim de 24h.
export function useNewOrdersCount(): number {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<MinimalOrder[]>([]);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();

    supabase
      .from("orders")
      .select("id, created_at, deleted_at")
      .is("deleted_at", null)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setOrders(data as MinimalOrder[]);
      });

    const channel = supabase
      .channel("orders-new-count")
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
            return prev;
          });
        },
      )
      .subscribe();

    // Re-avalia a janela de 24h a cada 5 minutos — sem isto, uma encomenda
    // criada há 23h59m continuaria a contar para sempre nesta sessão.
    const interval = setInterval(() => setNowTick(Date.now()), 5 * 60 * 1000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [supabase]);

  const cutoff = nowTick - WINDOW_MS;
  return orders.filter((o) => new Date(o.created_at).getTime() >= cutoff).length;
}
