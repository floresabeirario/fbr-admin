import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { PublicFigure } from "@/types/public-figure";
import type { Order } from "@/types/database";
import type { ProductionCostItem } from "@/types/production-cost";
import { buildProductionCostSnapshot, computeProductionCost } from "@/lib/production-cost";
import FiguraWorkbenchClient from "./workbench-client";

// Custo estimado de cortesia por tamanho (caso-base: moldura baixa, fundo
// transparente, sem extras). Sugestão; a Maria pode escrever outro valor.
function buildCostBySize(items: ProductionCostItem[]): Record<string, number> {
  const snapshot = buildProductionCostSnapshot(items);
  const map: Record<string, number> = {};
  for (const size of ["30x40", "40x50", "50x70"] as const) {
    const breakdown = computeProductionCost(
      {
        frame_size: size,
        frame_background: "transparente",
        pyramid_frame: false,
        frame_internal_type: "baixa",
        extra_small_frames: "nao",
        extra_small_frames_qty: null,
      },
      snapshot,
    );
    if (breakdown && breakdown.missing.length === 0) map[size] = breakdown.total;
  }
  return map;
}

export type LinkableOrder = Pick<Order, "id" | "order_id" | "client_name" | "status" | "event_date">;

export default async function FiguraWorkbenchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (!isUuid) notFound();

  const [figureRes, costItemsRes, ordersRes] = await Promise.all([
    supabase.from("public_figures").select("*").eq("id", id).single(),
    supabase.from("production_cost_items").select("*").is("deleted_at", null),
    supabase
      .from("orders")
      .select("id, order_id, client_name, status, event_date")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(400),
  ]);

  if (figureRes.error || !figureRes.data) notFound();

  const figure = figureRes.data as PublicFigure;
  const costBySize = buildCostBySize((costItemsRes.data ?? []) as ProductionCostItem[]);
  const orders = (ordersRes.data ?? []) as LinkableOrder[];

  return (
    <FiguraWorkbenchClient figure={figure} costBySize={costBySize} orders={orders} />
  );
}
