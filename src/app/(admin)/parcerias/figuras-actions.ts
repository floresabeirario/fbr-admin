"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import type {
  PublicFigure,
  PublicFigureInsert,
  PublicFigureUpdate,
  FigureInteraction,
  FigureAction,
  FigureDeliverable,
} from "@/types/public-figure";

// Tal como as Parcerias, as Figuras Públicas vivem na mesma aba e são
// editáveis por TODOS os 3 utilizadores (incluindo a Ana). Usamos
// `requireUser` em vez de `requireAdmin`.

export async function createFigureAction(input: PublicFigureInsert): Promise<PublicFigure> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_figures")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/parcerias");
  return data as PublicFigure;
}

export async function updateFigureAction(
  id: string,
  updates: PublicFigureUpdate,
): Promise<PublicFigure> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_figures")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/parcerias");
  revalidatePath(`/parcerias/figura/${id}`);
  return data as PublicFigure;
}

export async function archiveFigureAction(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("public_figures")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/parcerias");
}

// ── Histórico de interações (append-only) ────────────────────

export async function addFigureInteractionAction(
  figureId: string,
  interaction: Omit<FigureInteraction, "id" | "by">,
): Promise<PublicFigure> {
  const email = await requireUser();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("public_figures")
    .select("interactions")
    .eq("id", figureId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const list = (current?.interactions ?? []) as FigureInteraction[];
  const newItem: FigureInteraction = {
    ...interaction,
    id: crypto.randomUUID(),
    by: email,
  };
  const next = [newItem, ...list];

  const { data, error } = await supabase
    .from("public_figures")
    .update({ interactions: next })
    .eq("id", figureId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/parcerias/figura/${figureId}`);
  return data as PublicFigure;
}

export async function deleteFigureInteractionAction(
  figureId: string,
  interactionId: string,
): Promise<PublicFigure> {
  await requireUser();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("public_figures")
    .select("interactions")
    .eq("id", figureId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const list = (current?.interactions ?? []) as FigureInteraction[];
  const next = list.filter((i) => i.id !== interactionId);

  const { data, error } = await supabase
    .from("public_figures")
    .update({ interactions: next })
    .eq("id", figureId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/parcerias/figura/${figureId}`);
  return data as PublicFigure;
}

// ── Acções pendentes ─────────────────────────────────────────

export async function addFigureActionItemAction(
  figureId: string,
  action: Omit<FigureAction, "id" | "created_at" | "created_by" | "done" | "done_at" | "done_by">,
): Promise<PublicFigure> {
  const email = await requireUser();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("public_figures")
    .select("actions")
    .eq("id", figureId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const list = (current?.actions ?? []) as FigureAction[];
  const newItem: FigureAction = {
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
    .from("public_figures")
    .update({ actions: next })
    .eq("id", figureId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/parcerias/figura/${figureId}`);
  return data as PublicFigure;
}

export async function toggleFigureActionItemAction(
  figureId: string,
  actionId: string,
  done: boolean,
): Promise<PublicFigure> {
  const email = await requireUser();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("public_figures")
    .select("actions")
    .eq("id", figureId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const list = (current?.actions ?? []) as FigureAction[];
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
    .from("public_figures")
    .update({ actions: next })
    .eq("id", figureId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/parcerias/figura/${figureId}`);
  return data as PublicFigure;
}

export async function deleteFigureActionItemAction(
  figureId: string,
  actionId: string,
): Promise<PublicFigure> {
  await requireUser();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("public_figures")
    .select("actions")
    .eq("id", figureId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const list = (current?.actions ?? []) as FigureAction[];
  const next = list.filter((a) => a.id !== actionId);

  const { data, error } = await supabase
    .from("public_figures")
    .update({ actions: next })
    .eq("id", figureId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/parcerias/figura/${figureId}`);
  return data as PublicFigure;
}

// ── Contrapartida (entregáveis) ──────────────────────────────
// Checklist de publicações combinadas. Cada item liga a um link da
// publicação quando entregue. `done_by`/`done_at` carimbados no servidor.

export async function addFigureDeliverableAction(
  figureId: string,
  deliverable: Pick<FigureDeliverable, "title" | "due_date">,
): Promise<PublicFigure> {
  await requireUser();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("public_figures")
    .select("deliverables")
    .eq("id", figureId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const list = (current?.deliverables ?? []) as FigureDeliverable[];
  const newItem: FigureDeliverable = {
    id: crypto.randomUUID(),
    title: deliverable.title,
    due_date: deliverable.due_date,
    done: false,
    published_url: null,
    done_at: null,
    done_by: null,
  };
  const next = [...list, newItem];

  const { data, error } = await supabase
    .from("public_figures")
    .update({ deliverables: next })
    .eq("id", figureId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/parcerias/figura/${figureId}`);
  return data as PublicFigure;
}

export async function updateFigureDeliverableAction(
  figureId: string,
  deliverableId: string,
  patch: Partial<Pick<FigureDeliverable, "done" | "published_url" | "due_date" | "title">>,
): Promise<PublicFigure> {
  const email = await requireUser();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("public_figures")
    .select("deliverables")
    .eq("id", figureId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const list = (current?.deliverables ?? []) as FigureDeliverable[];
  const next = list.map((d) => {
    if (d.id !== deliverableId) return d;
    const updated = { ...d, ...patch };
    // Carimbar done_at/done_by ao marcar como publicado.
    if (patch.done !== undefined) {
      updated.done_at = patch.done ? new Date().toISOString() : null;
      updated.done_by = patch.done ? email : null;
    }
    return updated;
  });

  const { data, error } = await supabase
    .from("public_figures")
    .update({ deliverables: next })
    .eq("id", figureId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/parcerias/figura/${figureId}`);
  return data as PublicFigure;
}

export async function deleteFigureDeliverableAction(
  figureId: string,
  deliverableId: string,
): Promise<PublicFigure> {
  await requireUser();
  const supabase = await createClient();

  const { data: current, error: readErr } = await supabase
    .from("public_figures")
    .select("deliverables")
    .eq("id", figureId)
    .single();
  if (readErr) throw new Error(readErr.message);

  const list = (current?.deliverables ?? []) as FigureDeliverable[];
  const next = list.filter((d) => d.id !== deliverableId);

  const { data, error } = await supabase
    .from("public_figures")
    .update({ deliverables: next })
    .eq("id", figureId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath(`/parcerias/figura/${figureId}`);
  return data as PublicFigure;
}
