"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import type {
  Competitor,
  CompetitorInsert,
  CompetitorUpdate,
} from "@/types/competitor";
import type { PricingItem, PricingItemUpdate } from "@/types/pricing";

// Aba Finanças → Competição: só admin escreve. A Ana lê.

export async function createCompetitorAction(
  input: CompetitorInsert,
): Promise<Competitor> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitors")
    .insert({
      websites: [],
      prices: [],
      country: "PT",
      ...input,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
  return data as Competitor;
}

export async function updateCompetitorAction(
  id: string,
  updates: CompetitorUpdate,
): Promise<Competitor> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitors")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
  return data as Competitor;
}

export async function archiveCompetitorAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("competitors")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
}

// ============================================================
// PRICING ITEMS — Tabela de preços (cálculo automático do orçamento)
// ============================================================

export async function updatePricingItemAction(
  id: string,
  updates: PricingItemUpdate,
): Promise<PricingItem> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
  return data as PricingItem;
}

