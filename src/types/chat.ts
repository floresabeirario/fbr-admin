// ============================================================
// FBR Admin — Tipos TypeScript para Chat interno
// ============================================================

export interface ChatAttachment {
  kind: "image" | "video" | "audio";
  url: string;
  mime?: string | null;
  duration?: number | null; // segundos (para áudio/vídeo)
}

export interface ChatMessage {
  id: string;
  created_at: string;
  deleted_at: string | null;
  author_id: string | null;
  author_email: string;
  body: string;
  attachments: ChatAttachment[];
  reply_to: string | null;
  read_by: string[];
}

export type ChatMessageInsert = {
  author_email: string;
  body: string;
  attachments?: ChatAttachment[];
  reply_to?: string | null;
};
