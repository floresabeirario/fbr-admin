export type WhatsappConversation = {
  id: string;
  phone_e164: string;
  display_phone: string | null;
  contact_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_direction: "received" | "sent_echo" | null;
  unread_count: number;
  archived: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type WhatsappMessageContentType =
  | "text" | "image" | "video" | "audio" | "document"
  | "sticker" | "location" | "contacts" | "reaction"
  | "system" | "unsupported";

export type WhatsappMessage = {
  id: string;
  conversation_id: string;
  wamid: string;
  direction: "received" | "sent_echo";
  content_type: WhatsappMessageContentType;
  text: string | null;
  media_id: string | null;
  media_mime: string | null;
  media_url_drive: string | null;
  media_drive_file_id: string | null;
  media_pending: boolean;
  reply_to_wamid: string | null;
  reaction_target_wamid: string | null;
  received_at: string;
  created_at: string;
  delivery_status: "delivered" | "read" | "failed" | null;
  delivered_at: string | null;
  read_at: string | null;
};
