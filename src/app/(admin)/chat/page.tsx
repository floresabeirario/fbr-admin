import { createClient } from "@/lib/supabase/server";
import { getCurrentEmail } from "@/lib/auth/server";
import type { ChatMessage } from "@/types/chat";
import ChatClient from "./chat-client";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = await createClient();
  const email = await getCurrentEmail();

  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);

  const messages: ChatMessage[] = (data ?? []) as ChatMessage[];

  return <ChatClient initialMessages={messages} currentEmail={email} />;
}
