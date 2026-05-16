"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import type { WhatsAppEntry } from "@/types/whatsapp";
import { parseWhatsAppExport } from "@/lib/whatsapp-import";

// ─── Helpers ────────────────────────────────────────────────

async function loadLog(orderId: string): Promise<{ id: string; whatsapp_log: WhatsAppEntry[] }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, whatsapp_log")
    .eq("id", orderId)
    .single();
  if (error || !data) {
    throw new Error("Encomenda não encontrada.");
  }
  return {
    id: data.id,
    whatsapp_log: (data.whatsapp_log ?? []) as WhatsAppEntry[],
  };
}

async function saveLog(orderId: string, entries: WhatsAppEntry[]): Promise<void> {
  // Ordena cronologicamente antes de gravar — torna a leitura previsível.
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ whatsapp_log: sorted })
    .eq("id", orderId);
  if (error) throw new Error(`Não foi possível gravar o registo: ${error.message}`);
  revalidatePath(`/preservacao/${orderId}`);
}

// ─── Actions ────────────────────────────────────────────────

export async function addWhatsAppEntryAction(
  orderId: string,
  entry: WhatsAppEntry,
): Promise<WhatsAppEntry[]> {
  await requireAdmin();
  const { whatsapp_log } = await loadLog(orderId);
  const next = [...whatsapp_log, entry];
  await saveLog(orderId, next);
  return next.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export async function updateWhatsAppEntryAction(
  orderId: string,
  entryId: string,
  patch: Partial<Omit<WhatsAppEntry, "id">>,
): Promise<WhatsAppEntry[]> {
  await requireAdmin();
  const { whatsapp_log } = await loadLog(orderId);
  const next = whatsapp_log.map((e) => (e.id === entryId ? { ...e, ...patch } : e));
  await saveLog(orderId, next);
  return next.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

export async function deleteWhatsAppEntryAction(
  orderId: string,
  entryId: string,
): Promise<WhatsAppEntry[]> {
  await requireAdmin();
  const { whatsapp_log } = await loadLog(orderId);
  const next = whatsapp_log.filter((e) => e.id !== entryId);
  await saveLog(orderId, next);
  return next;
}

/**
 * Importa um export do WhatsApp (Web → Exportar conversa → Sem multimédia).
 *
 * `mode`:
 *   - "append" (default) — acrescenta às entradas existentes (pode duplicar
 *     se importares 2× o mesmo ficheiro). Útil para juntar conversas.
 *   - "replace" — apaga as entradas existentes e substitui pelas
 *     importadas. Útil para um "reset" da conversa.
 */
export async function importWhatsAppExportAction(
  orderId: string,
  rawText: string,
  mode: "append" | "replace" = "append",
  ourName?: string,
): Promise<{
  entries: WhatsAppEntry[];
  imported: number;
  systemFiltered: number;
  unparsedLines: number;
}> {
  await requireAdmin();
  const parsed = parseWhatsAppExport(rawText, ourName);
  if (parsed.entries.length === 0) {
    throw new Error(
      "Não consegui identificar nenhuma mensagem. Verifica se exportaste do WhatsApp Web em formato .txt (sem multimédia).",
    );
  }
  const { whatsapp_log } = await loadLog(orderId);
  const next = mode === "replace" ? parsed.entries : [...whatsapp_log, ...parsed.entries];
  await saveLog(orderId, next);
  return {
    entries: next.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    ),
    imported: parsed.entries.length,
    systemFiltered: parsed.systemFiltered,
    unparsedLines: parsed.unparsedLines,
  };
}

/**
 * Apaga TODO o registo WhatsApp da encomenda. Confirmação na UI.
 */
export async function clearWhatsAppLogAction(orderId: string): Promise<void> {
  await requireAdmin();
  await saveLog(orderId, []);
}
