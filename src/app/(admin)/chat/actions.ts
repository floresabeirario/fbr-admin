"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, getCurrentEmail } from "@/lib/auth/server";
import type { ChatMessage } from "@/types/chat";

export async function sendChatMessageAction(body: string, replyTo: string | null = null): Promise<ChatMessage> {
  await requireUser();
  const email = await getCurrentEmail();
  if (!email) throw new Error("Sem email");
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Mensagem vazia");
  if (trimmed.length > 2000) throw new Error("Mensagem demasiado longa (máx 2000)");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ author_email: email, body: trimmed, reply_to: replyTo })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/chat");
  return data as ChatMessage;
}

export async function deleteChatMessageAction(id: string): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("chat_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/chat");
}

export async function markChatMessagesReadAction(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await requireUser();
  const supabase = await createClient();
  // Usa RPC SECURITY DEFINER (migração 043) — a política UPDATE de
  // chat_messages só permite ao autor mexer na própria mensagem,
  // pelo que UPDATE directo falharia silenciosamente para mensagens
  // dos outros, que são precisamente as que queremos marcar como lidas.
  const { error } = await supabase.rpc("mark_chat_messages_read", {
    message_ids: ids,
  });
  if (error) throw new Error(error.message);
}
