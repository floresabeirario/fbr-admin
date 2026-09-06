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
import { parsePhoneQuery, phoneMatches } from "@/lib/phone-search";

export type SearchResultKind =
  | "order"
  | "voucher"
  | "partner"
  | "idea"
  | "recipe"
  | "whatsapp";

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

  const whatsappOr = [
    `contact_name.ilike.${ilike}`,
    `phone_e164.ilike.${ilike}`,
    `display_phone.ilike.${ilike}`,
    `notes.ilike.${ilike}`,
    `last_message_preview.ilike.${ilike}`,
  ].join(",");

  const [ordersRes, vouchersRes, partnersRes, ideasRes, recipesRes, whatsappRes] =
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
      supabase
        .from("whatsapp_conversations")
        .select("id, phone_e164, display_phone, contact_name, last_message_preview")
        .eq("archived", false)
        .or(whatsappOr)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(LIMIT_PER_KIND),
    ]);

  const results: SearchResult[] = [];

  // Telemóvel: o ilike acima falha com separadores ("+351 910 843 885"
  // vs "910843885"). Quando a pesquisa parece um número, puxam-se os
  // telefones das 3 tabelas que os têm e compara-se em JS pelo fim do
  // número (centenas de linhas, é barato; é o que o resto da plataforma
  // faz para ligar conversas a encomendas). Estes resultados vão à frente.
  const phoneHits: SearchResult[] = [];
  const phoneQuery = parsePhoneQuery(q);
  if (phoneQuery) {
    const [phoneOrders, phoneVouchers, phoneConvs] = await Promise.all([
      supabase
        .from("orders")
        .select("id, order_id, client_name, event_location, phone")
        .is("deleted_at", null)
        .not("phone", "is", null)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("vouchers")
        .select("id, code, sender_name, recipient_name, amount, sender_phone")
        .is("deleted_at", null)
        .not("sender_phone", "is", null)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("whatsapp_conversations")
        .select("id, phone_e164, display_phone, contact_name, last_message_preview")
        .eq("archived", false)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(2000),
    ]);
    type PhoneOrder = { id: string; order_id: string; client_name: string; event_location: string | null; phone: string | null };
    for (const row of ((phoneOrders.data ?? []) as PhoneOrder[]).filter((r) => phoneMatches(r.phone, phoneQuery)).slice(0, LIMIT_PER_KIND)) {
      phoneHits.push({
        kind: "order",
        id: row.id,
        title: row.client_name || "(sem nome)",
        subtitle: row.event_location ?? null,
        meta: row.order_id,
        href: `/preservacao/${row.order_id}`,
      });
    }
    type PhoneVoucher = { id: string; code: string; sender_name: string; recipient_name: string; amount: number; sender_phone: string | null };
    for (const row of ((phoneVouchers.data ?? []) as PhoneVoucher[]).filter((r) => phoneMatches(r.sender_phone, phoneQuery)).slice(0, LIMIT_PER_KIND)) {
      const amount = Number(row.amount).toLocaleString("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
      phoneHits.push({
        kind: "voucher",
        id: row.id,
        title: `${row.sender_name} → ${row.recipient_name}`,
        subtitle: amount,
        meta: row.code,
        href: `/vale-presente/${row.code}`,
      });
    }
    type PhoneConv = { id: string; phone_e164: string; display_phone: string | null; contact_name: string | null; last_message_preview: string | null };
    for (const row of ((phoneConvs.data ?? []) as PhoneConv[]).filter((r) => phoneMatches(r.phone_e164, phoneQuery)).slice(0, LIMIT_PER_KIND)) {
      phoneHits.push({
        kind: "whatsapp",
        id: row.id,
        title: row.contact_name || row.display_phone || row.phone_e164,
        subtitle: row.last_message_preview ?? null,
        meta: row.display_phone ?? row.phone_e164,
        href: `/whatsapp?conv=${row.id}`,
      });
    }
  }

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

  type WhatsappHit = {
    id: string;
    phone_e164: string;
    display_phone: string | null;
    contact_name: string | null;
    last_message_preview: string | null;
  };
  for (const row of (whatsappRes.data ?? []) as WhatsappHit[]) {
    results.push({
      kind: "whatsapp",
      id: row.id,
      title: row.contact_name || row.display_phone || row.phone_e164,
      subtitle: row.last_message_preview ?? null,
      meta: row.display_phone ?? row.phone_e164,
      href: `/whatsapp?conv=${row.id}`,
    });
  }

  // Os acertos por telemóvel vão à frente; o mesmo registo apanhado
  // pelas duas vias aparece uma vez só.
  const seen = new Set<string>();
  const merged = [...phoneHits, ...results].filter((r) => {
    const key = `${r.kind}-${r.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { query, results: merged };
}
