"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markConversationReadAction(conversationId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_whatsapp_conversation_read", { conv_id: conversationId });
  revalidatePath("/whatsapp");
}

export async function archiveConversationAction(
  conversationId: string,
  archived: boolean,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("whatsapp_conversations")
    .update({ archived })
    .eq("id", conversationId);
  revalidatePath("/whatsapp");
}

export async function updateConversationNotesAction(
  conversationId: string,
  notes: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("whatsapp_conversations")
    .update({ notes: notes.trim() === "" ? null : notes })
    .eq("id", conversationId);
  revalidatePath("/whatsapp");
}
