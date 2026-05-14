"use server";

// ============================================================
// FBR Admin — Pesquisa global (Cmd+K)
// ============================================================
// Procura em paralelo nas 5 tabelas principais: orders, vouchers,
// partners, ideas, recipes. Limita o resultado por tipo para
// manter a UI rápida e legível.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";

export type SearchResultKind =
  | "order"
  | "voucher"
  | "partner"
  | "idea"
  | "recipe";

export interface SearchResult {
  kind: SearchResultKind;
  id: string;
  title: string;
  subtitle: string | null;
  meta: string | null;
  href: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

const LIMIT_PER_KIND = 6;

function sanitize(q: string): string {
  // Caracteres que partem o parser do .or() do PostgREST.
  return q.replace(/[,()*]/g, " ").trim();
}

export async function globalSearchAction(query: string): Promise<SearchResponse> {
  await requireUser();

  const q = sanitize(query);
  if (q.length < 2) return { query, results: [] };

  const ilike = `%${q}%`;
  const supabase = await createClient();

  const ordersOr = [
    `client_name.ilike.${ilike}`,
    `order_id.ilike.${ilike}`,
    `email.ilike.${ilike}`,
    `phone.ilike.${ilike}`,
    `event_location.ilike.${ilike}`,
    `couple_names.ilike.${ilike}`,
    `additional_notes.ilike.${ilike}`,
    `gift_voucher_code.ilike.${ilike}`,
    `nif.ilike.${ilike}`,
  ].join(",");

  const vouchersOr = [
    `code.ilike.${ilike}`,
    `sender_name.ilike.${ilike}`,
    `recipient_name.ilike.${ilike}`,
    `sender_email.ilike.${ilike}`,
    `sender_phone.ilike.${ilike}`,
    `message.ilike.${ilike}`,
    `comments.ilike.${ilike}`,
    `nif.ilike.${ilike}`,
  ].join(",");

  const partnersOr = [
    `name.ilike.${ilike}`,
    `contact_person.ilike.${ilike}`,
    `email.ilike.${ilike}`,
    `location_label.ilike.${ilike}`,
    `notes.ilike.${ilike}`,
  ].join(",");

  const ideasOr = [
    `title.ilike.${ilike}`,
    `description.ilike.${ilike}`,
  ].join(",");

  const recipesOr = [
    `flower_name.ilike.${ilike}`,
    `scientific_name.ilike.${ilike}`,
    `intro.ilike.${ilike}`,
    `observations.ilike.${ilike}`,
  ].join(",");

  const [ordersRes, vouchersRes, partnersRes, ideasRes, recipesRes] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, order_id, client_name, event_location, event_date, status")
        .is("deleted_at", null)
        .or(ordersOr)
        .order("created_at", { ascending: false })
        .limit(LIMIT_PER_KIND),
      supabase
        .from("vouchers")
        .select("id, code, sender_name, recipient_name, amount, payment_status")
        .is("deleted_at", null)
        .or(vouchersOr)
        .order("created_at", { ascending: false })
        .limit(LIMIT_PER_KIND),
      supabase
        .from("partners")
        .select("id, name, category, status, location_label")
        .is("deleted_at", null)
        .or(partnersOr)
        .order("name", { ascending: true })
        .limit(LIMIT_PER_KIND),
      supabase
        .from("ideas")
        .select("id, title, importance, status")
        .is("deleted_at", null)
        .or(ideasOr)
        .order("created_at", { ascending: false })
        .limit(LIMIT_PER_KIND),
      supabase
        .from("recipes")
        .select("id, flower_name, scientific_name, difficulty")
        .is("deleted_at", null)
        .or(recipesOr)
        .order("flower_name", { ascending: true })
        .limit(LIMIT_PER_KIND),
    ]);

  const results: SearchResult[] = [];

  type OrderHit = {
    id: string;
    order_id: string;
    client_name: string;
    event_location: string | null;
    event_date: string | null;
    status: string;
  };
  for (const row of (ordersRes.data ?? []) as OrderHit[]) {
    results.push({
      kind: "order",
      id: row.id,
      title: row.client_name || "(sem nome)",
      subtitle: row.event_location ?? null,
      meta: row.order_id,
      href: `/preservacao/${row.order_id}`,
    });
  }

  type VoucherHit = {
    id: string;
    code: string;
    sender_name: string;
    recipient_name: string;
    amount: number;
    payment_status: string;
  };
  for (const row of (vouchersRes.data ?? []) as VoucherHit[]) {
    const amount = Number(row.amount).toLocaleString("pt-PT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    });
    results.push({
      kind: "voucher",
      id: row.id,
      title: `${row.sender_name} → ${row.recipient_name}`,
      subtitle: `${amount}`,
      meta: row.code,
      href: `/vale-presente/${row.code}`,
    });
  }

  type PartnerHit = {
    id: string;
    name: string;
    category: string;
    status: string;
    location_label: string | null;
  };
  const PARTNER_CATEGORY_LABEL: Record<string, string> = {
    wedding_planners: "Wedding planner",
    floristas: "Florista",
    quintas_eventos: "Quinta de eventos",
    outros: "Outro",
  };
  for (const row of (partnersRes.data ?? []) as PartnerHit[]) {
    results.push({
      kind: "partner",
      id: row.id,
      title: row.name,
      subtitle: row.location_label ?? null,
      meta: PARTNER_CATEGORY_LABEL[row.category] ?? row.category,
      href: `/parcerias/${row.id}`,
    });
  }

  type IdeaHit = {
    id: string;
    title: string;
    importance: string;
    status: string;
  };
  for (const row of (ideasRes.data ?? []) as IdeaHit[]) {
    results.push({
      kind: "idea",
      id: row.id,
      title: row.title,
      subtitle: null,
      meta: row.importance,
      href: `/ideias#${row.id}`,
    });
  }

  type RecipeHit = {
    id: string;
    flower_name: string;
    scientific_name: string | null;
    difficulty: string;
  };
  for (const row of (recipesRes.data ?? []) as RecipeHit[]) {
    results.push({
      kind: "recipe",
      id: row.id,
      title: row.flower_name,
      subtitle: row.scientific_name ?? null,
      meta: row.difficulty,
      href: `/livro-receitas/${row.id}`,
    });
  }

  return { query, results };
}
