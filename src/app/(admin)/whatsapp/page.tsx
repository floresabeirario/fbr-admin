import { createClient } from "@/lib/supabase/server";
import type { WhatsappConversation } from "@/types/whatsapp-live";
import WhatsappClient from "./whatsapp-client";

export const dynamic = "force-dynamic";

export default async function WhatsappPage() {
  const supabase = await createClient();

  const { data: convs } = await supabase
    .from("whatsapp_conversations")
    .select(
      "id, phone_e164, display_phone, contact_name, last_message_at, last_message_preview, last_message_direction, unread_count, archived, notes, created_at, updated_at",
    )
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(500);

  // Tambem agarrar nomes/codigos de encomendas associadas por telefone
  // (matching por digitos para acomodar formatos diferentes em orders.phone).
  // Para v1 simples: agarrar todos os orders com phone nao-nulo e fazer
  // matching client-side.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_id, client_name, phone, status, drive_folder_url, flowers_photo_url")
    .not("phone", "is", null)
    .is("deleted_at", null)
    .limit(2000);

  return (
    <WhatsappClient
      initialConversations={(convs ?? []) as WhatsappConversation[]}
      orders={(orders ?? []) as Array<{
        id: string;
        order_id: string;
        client_name: string | null;
        phone: string | null;
        status: string;
        drive_folder_url: string | null;
        flowers_photo_url: string | null;
      }>}
    />
  );
}
