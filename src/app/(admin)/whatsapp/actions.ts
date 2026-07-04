"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import { revalidatePath } from "next/cache";

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
  category: "cliente" | "lead" | "operacional" | null,
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  // null = volta ao automático (derivado do estado da encomenda no cliente).
  await supabase
    .from("whatsapp_conversations")
    .update({ category })
    .eq("id", conversationId);
  revalidatePath("/whatsapp");
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
