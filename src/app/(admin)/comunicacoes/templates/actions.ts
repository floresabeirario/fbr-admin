"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import type {
  MessageTemplateInsert,
  MessageTemplateUpdate,
  SystemSettingKey,
} from "@/types/message-template";

// ─── Templates ──────────────────────────────────────────────

export async function createTemplateAction(input: MessageTemplateInsert): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").insert({
    slug: input.slug,
    name: input.name,
    language: input.language,
    category: input.category,
    body: input.body,
    suggested_statuses: input.suggested_statuses ?? [],
    scope: input.scope ?? "order",
    position: input.position ?? 0,
    is_seed: false,
  });
  if (error) throw new Error(`Não foi possível criar o template: ${error.message}`);
  revalidatePath("/comunicacoes/templates");
}

export async function updateTemplateAction(
  id: string,
  patch: MessageTemplateUpdate,
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  // is_seed e slug não devem ser editáveis via UI normal — limpa-os do patch.
  const { ...safe } = patch;
  delete (safe as Record<string, unknown>).is_seed;
  const { error } = await supabase
    .from("message_templates")
    .update(safe)
    .eq("id", id);
  if (error) throw new Error(`Não foi possível guardar o template: ${error.message}`);
  revalidatePath("/comunicacoes/templates");
}

export async function archiveTemplateAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("message_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Não foi possível arquivar o template: ${error.message}`);
  revalidatePath("/comunicacoes/templates");
}

export async function restoreTemplateAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("message_templates")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw new Error(`Não foi possível restaurar o template: ${error.message}`);
  revalidatePath("/comunicacoes/templates");
}

export async function duplicateTemplateAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: original, error: readErr } = await supabase
    .from("message_templates")
    .select("name, language, category, body, suggested_statuses, scope, position")
    .eq("id", id)
    .single();
  if (readErr || !original) {
    throw new Error("Não foi possível ler o template original.");
  }

  // Gera slug único acrescentando -copia (e incrementa se já existir)
  const baseSlug = `${original.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}_copia`;
  let slug = baseSlug;
  let i = 1;
  while (true) {
    const { data: clash } = await supabase
      .from("message_templates")
      .select("id")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();
    if (!clash) break;
    i++;
    slug = `${baseSlug}_${i}`;
  }

  const { error: insertErr } = await supabase.from("message_templates").insert({
    slug,
    name: `${original.name} (cópia)`,
    language: original.language,
    category: original.category,
    body: original.body,
    suggested_statuses: original.suggested_statuses,
    scope: original.scope,
    position: original.position + 1,
    is_seed: false,
  });
  if (insertErr) throw new Error(`Não foi possível duplicar: ${insertErr.message}`);
  revalidatePath("/comunicacoes/templates");
}

// ─── System settings (dados de pagamento, morada do estúdio) ──

export async function updateSystemSettingAction(
  key: SystemSettingKey,
  value: string,
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  // upsert: insere se não existir, actualiza se já existir.
  const { error } = await supabase
    .from("system_settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(`Não foi possível guardar a configuração: ${error.message}`);
  revalidatePath("/comunicacoes/templates");
  revalidatePath("/comunicacoes/claudio");
}
