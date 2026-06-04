"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireAdmin } from "@/lib/auth/server";
import type {
  Partner,
  PartnerInsert,
  PartnerUpdate,
  PartnerInteraction,
  PartnerAction,
} from "@/types/partner";
import type { CommissionKind } from "@/lib/commissions";

// Aba Parcerias é editável por TODOS os 3 utilizadores (incluindo a Ana,
// que noutras abas é só leitura). Usamos `requireUser` em vez de
// `requireAdmin`.

export async function createPartnerAction(input: PartnerInsert): Promise<Partner> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/parcerias");
  return data as Partner;
}

export async function updatePartnerAction(
  id: string,
  updates: PartnerUpdate,
): Promise<Partner> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("partners")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/parcerias");
  revalidatePath(`/parcerias/${id}`);
  return data as Partner;
}

// ── Comissões por saldar ─────────────────────────────────────
// A comissão vive na encomenda/vale (campo `partner_commission_status`),
// não no parceiro. Marcar como paga é uma acção financeira → requer admin
// (a Ana pode ver a lista, mas não dá comissões por pagas).

export async function markCommissionPaidAction(
  kind: CommissionKind,
  rowId: string,
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const table = kind === "order" ? "orders" : "vouchers";
  const { error } = await supabase
    .from(table)
    .update({ partner_commission_status: "paga" })
    .eq("id", rowId);
  if (error) throw new Error(error.message);
  revalidatePath("/parcerias");
}

export async function archivePartnerAction(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("partners")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/parcerias");
}

// ── Histórico de interações ──────────────────────────────────
// Append-only: lê o array actual, anexa, regrava. Server-side para
// poder gravar o email do utilizador que registou.

export async function addInteractionAction(
  partnerId: string,
  interaction: Omit<PartnerInteraction, "id" | "by">,
): Promise<Partner> {
  const email = await requireUser();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("partners")
    .select("interactions")
    .eq("id", partnerId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const list = (current?.interactions ?? []) as PartnerInteraction[];
  const newItem: PartnerInteraction = {
    ...interaction,
    id: crypto.randomUUID(),
    by: email,
  };
  const next = [newItem, ...list];

  const { data, error } = await supabase
    .from("partners")
    .update({ interactions: next })
    .eq("id", partnerId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/parcerias/${partnerId}`);
  return data as Partner;
}

export async function deleteInteractionAction(
  partnerId: string,
  interactionId: string,
): Promise<Partner> {
  await requireUser();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("partners")
    .select("interactions")
    .eq("id", partnerId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const list = (current?.interactions ?? []) as PartnerInteraction[];
  const next = list.filter((i) => i.id !== interactionId);

  const { data, error } = await supabase
    .from("partners")
    .update({ interactions: next })
    .eq("id", partnerId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/parcerias/${partnerId}`);
  return data as Partner;
}

// ── Acções pendentes ─────────────────────────────────────────

export async function addActionAction(
  partnerId: string,
  action: Omit<PartnerAction, "id" | "created_at" | "created_by" | "done" | "done_at" | "done_by">,
): Promise<Partner> {
  const email = await requireUser();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("partners")
    .select("actions")
    .eq("id", partnerId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const list = (current?.actions ?? []) as PartnerAction[];
  const newItem: PartnerAction = {
    ...action,
    id: crypto.randomUUID(),
    done: false,
    done_at: null,
    done_by: null,
    created_at: new Date().toISOString(),
    created_by: email,
  };
  const next = [...list, newItem];

  const { data, error } = await supabase
    .from("partners")
    .update({ actions: next })
    .eq("id", partnerId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/parcerias/${partnerId}`);
  return data as Partner;
}

export async function toggleActionAction(
  partnerId: string,
  actionId: string,
  done: boolean,
): Promise<Partner> {
  const email = await requireUser();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("partners")
    .select("actions")
    .eq("id", partnerId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const list = (current?.actions ?? []) as PartnerAction[];
  const next = list.map((a) =>
    a.id === actionId
      ? {
          ...a,
          done,
          done_at: done ? new Date().toISOString() : null,
          done_by: done ? email : null,
        }
      : a,
  );

  const { data, error } = await supabase
    .from("partners")
    .update({ actions: next })
    .eq("id", partnerId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/parcerias/${partnerId}`);
  return data as Partner;
}

export async function deleteActionAction(
  partnerId: string,
  actionId: string,
): Promise<Partner> {
  await requireUser();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("partners")
    .select("actions")
    .eq("id", partnerId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const list = (current?.actions ?? []) as PartnerAction[];
  const next = list.filter((a) => a.id !== actionId);

  const { data, error } = await supabase
    .from("partners")
    .update({ actions: next })
    .eq("id", partnerId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/parcerias/${partnerId}`);
  return data as Partner;
}
