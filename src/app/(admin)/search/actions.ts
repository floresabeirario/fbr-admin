"use server";

// ============================================================
// FBR Admin — Pesquisa global (Cmd+K)
// ============================================================
// Procura em paralelo nas tabelas principais: orders, vouchers,
// partners, ideas, recipes. Limita o resultado por tipo para
// manter a UI rápida e legível.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { parsePhoneQuery, phoneMatches } from "@/lib/phone-search";
import { foldSearch, matchesSearch } from "@/lib/search-text";

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

// Quantas linhas de cada tabela se trazem para filtrar aqui. A pesquisa
// por texto já não usa o `ilike` da BD porque esse distingue acentos
// ("joao" não encontrava "João"); com estes volumes (centenas de linhas)
// filtrar em JS é barato, é o mesmo que já se fazia para os telemóveis.
const SCAN_LIMIT = 2000;

/** Primeiras `LIMIT_PER_KIND` linhas em que algum dos campos contém o termo. */
function pick<T>(rows: T[] | null, term: string, fields: (row: T) => Array<string | null | undefined>): T[] {
  return (rows ?? []).filter((r) => matchesSearch(term, ...fields(r))).slice(0, LIMIT_PER_KIND);
}

export async function globalSearchAction(query: string): Promise<SearchResponse> {
  await requireUser();

  const q = query.trim();
  if (q.length < 2) return { query, results: [] };

  const term = foldSearch(q);
  const supabase = await createClient();

  const [ordersRes, vouchersRes, partnersRes, ideasRes, recipesRes, whatsappRes] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, order_id, client_name, event_location, event_date, status, email, phone, couple_names, additional_notes, gift_voucher_code, nif")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(SCAN_LIMIT),
      supabase
        .from("vouchers")
        .select("id, code, sender_name, recipient_name, amount, payment_status, sender_email, sender_phone, message, comments, nif")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(SCAN_LIMIT),
      supabase
        .from("partners")
        .select("id, name, category, status, location_label, contact_person, email, notes")
        .is("deleted_at", null)
        .order("name", { ascending: true })
        .limit(SCAN_LIMIT),
      supabase
        .from("ideas")
        .select("id, title, importance, status, description")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(SCAN_LIMIT),
      supabase
        .from("recipes")
        .select("id, flower_name, scientific_name, difficulty, intro, observations")
        .is("deleted_at", null)
        .order("flower_name", { ascending: true })
        .limit(SCAN_LIMIT),
      supabase
        .from("whatsapp_conversations")
        .select("id, phone_e164, display_phone, contact_name, last_message_preview, notes")
        .eq("archived", false)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(SCAN_LIMIT),
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
  type OrderRow = OrderHit & { email: string | null; phone: string | null; couple_names: string | null; additional_notes: string | null; gift_voucher_code: string | null; nif: string | null };
  for (const row of pick(ordersRes.data as OrderRow[] | null, term, (r) => [r.client_name, r.order_id, r.email, r.phone, r.event_location, r.couple_names, r.additional_notes, r.gift_voucher_code, r.nif])) {
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
  type VoucherRow = VoucherHit & { sender_email: string | null; sender_phone: string | null; message: string | null; comments: string | null; nif: string | null };
  for (const row of pick(vouchersRes.data as VoucherRow[] | null, term, (r) => [r.code, r.sender_name, r.recipient_name, r.sender_email, r.sender_phone, r.message, r.comments, r.nif])) {
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
  type PartnerRow = PartnerHit & { contact_person: string | null; email: string | null; notes: string | null };
  const PARTNER_CATEGORY_LABEL: Record<string, string> = {
    wedding_planners: "Wedding planner",
    floristas: "Florista",
    quintas_eventos: "Quinta de eventos",
    outros: "Outro",
  };
  for (const row of pick(partnersRes.data as PartnerRow[] | null, term, (r) => [r.name, r.contact_person, r.email, r.location_label, r.notes])) {
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
  type IdeaRow = IdeaHit & { description: string | null };
  for (const row of pick(ideasRes.data as IdeaRow[] | null, term, (r) => [r.title, r.description])) {
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
  type RecipeRow = RecipeHit & { intro: string | null; observations: string | null };
  for (const row of pick(recipesRes.data as RecipeRow[] | null, term, (r) => [r.flower_name, r.scientific_name, r.intro, r.observations])) {
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
  type WhatsappRow = WhatsappHit & { notes: string | null };
  for (const row of pick(whatsappRes.data as WhatsappRow[] | null, term, (r) => [r.contact_name, r.phone_e164, r.display_phone, r.notes, r.last_message_preview])) {
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
