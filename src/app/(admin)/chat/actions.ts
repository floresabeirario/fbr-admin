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
  const email = await getCurrentEmail();
  if (!email) return;
  const supabase = await createClient();
  // Fetch + write em batch para anexar email ao read_by sem duplicar
  const { data: rows } = await supabase
    .from("chat_messages")
    .select("id, read_by")
    .in("id", ids);
  if (!rows) return;
  await Promise.all(
    rows
      .filter((r) => !(r.read_by as string[]).includes(email))
      .map((r) =>
        supabase
          .from("chat_messages")
          .update({ read_by: [...(r.read_by as string[]), email] })
          .eq("id", r.id)
      )
  );
}
