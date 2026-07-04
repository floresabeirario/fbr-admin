"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";
import {
  normalizeLabels,
  parseLabelsJson,
  SETTINGS_KEY,
  type WhatsappLabel,
} from "@/lib/whatsapp/labels";

// As RLS destas tabelas já só deixam admins escrever; o requireAdmin
// alinha estas actions com a convenção de todas as outras (falha com
// mensagem clara em vez do silêncio da RLS).

export async function markConversationReadAction(conversationId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.rpc("mark_whatsapp_conversation_read", { conv_id: conversationId });
  revalidatePath("/whatsapp");
}

export async function markConversationUnreadAction(conversationId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  // Marca como "1 nao lida" para a bolinha verde voltar a aparecer (follow-up).
  await supabase
    .from("whatsapp_conversations")
    .update({ unread_count: 1 })
    .eq("id", conversationId);
  revalidatePath("/whatsapp");
}

export async function archiveConversationAction(
  conversationId: string,
  archived: boolean,
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("whatsapp_conversations")
    .update({ archived })
    .eq("id", conversationId);
  revalidatePath("/whatsapp");
}

export async function setConversationCategoryAction(
  conversationId: string,
  category: string | null,
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  // null = volta ao automático (derivado do estado da encomenda no cliente).
  await supabase
    .from("whatsapp_conversations")
    .update({ category: category?.trim() || null })
    .eq("id", conversationId);
  revalidatePath("/whatsapp");
}

// Guarda a lista de etiquetas (definições de nome/cor) em system_settings.
// Devolve a lista normalizada para o cliente refletir imediatamente.
export async function saveWhatsappLabelsAction(
  labels: WhatsappLabel[],
): Promise<WhatsappLabel[]> {
  await requireAdmin();
  const clean = normalizeLabels(labels);
  const supabase = await createClient();
  await supabase
    .from("system_settings")
    .upsert({ key: SETTINGS_KEY, value: JSON.stringify(clean) });
  revalidatePath("/whatsapp");
  return clean;
}

// Lê as etiquetas guardadas (com fallback aos defaults). Usado pela página.
export async function getWhatsappLabels(): Promise<WhatsappLabel[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return parseLabelsJson(typeof data?.value === "string" ? data.value : null);
}

export async function updateConversationNotesAction(
  conversationId: string,
  notes: string,
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase
    .from("whatsapp_conversations")
    .update({ notes: notes.trim() === "" ? null : notes })
    .eq("id", conversationId);
  revalidatePath("/whatsapp");
}
