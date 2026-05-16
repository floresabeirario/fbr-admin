// ============================================================
// Tipos para o registo manual de conversas WhatsApp
// ============================================================
// Migração 042 adicionou `orders.whatsapp_log JSONB` com array de
// WhatsAppEntry. Sem API oficial do WhatsApp, a Maria cola entradas
// manualmente no workbench (texto, screenshots em Drive, ou importa
// um ficheiro exportado pelo "WhatsApp → Exportar conversa").
// ============================================================

export type WhatsAppDirection = "sent" | "received";

export interface WhatsAppEntry {
  /** UUID v4 gerado no cliente. */
  id: string;
  /** ISO datetime. */
  timestamp: string;
  /** "sent" = FBR enviou; "received" = cliente enviou. */
  direction: WhatsAppDirection;
  /** Texto da mensagem. Pode ser vazio se só houver screenshot. */
  content: string;
  /** URLs de screenshots/ficheiros no Drive. */
  screenshot_urls?: string[];
}
