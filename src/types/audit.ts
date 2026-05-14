// ============================================================
// FBR Admin — Tipos do audit log
// ============================================================

export type AuditAction = "INSERT" | "UPDATE" | "DELETE";

export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_by: string | null;
  changed_by_email: string | null;
  changed_at: string;
}

export const AUDIT_TABLE_LABELS: Record<string, string> = {
  orders: "Encomendas",
  vouchers: "Vales",
  partners: "Parceiros",
  tasks: "Tarefas",
  personal_checklist: "Checklist",
  competitors: "Competição",
  pricing_items: "Tabela de preços",
  ideas: "Ideias",
  public_status_settings: "Mensagens default",
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  INSERT: "Criado",
  UPDATE: "Alterado",
  DELETE: "Apagado",
};

export const AUDIT_ACTION_COLORS: Record<AuditAction, string> = {
  INSERT: "bg-emerald-100 text-emerald-800 border-emerald-300",
  UPDATE: "bg-sky-100 text-sky-800 border-sky-300",
  DELETE: "bg-rose-100 text-rose-800 border-rose-300",
};

/**
 * Calcula as chaves alteradas entre old e new (UPDATE).
 * Ignora campos automáticos (updated_at, etc.).
 */
const IGNORED_KEYS = new Set([
  "updated_at",
  "public_status_updated_at",
]);

export function diffValues(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
): Array<{ key: string; old: unknown; new: unknown }> {
  if (!oldValues || !newValues) return [];
  const keys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
  const diffs: Array<{ key: string; old: unknown; new: unknown }> = [];
  for (const k of keys) {
    if (IGNORED_KEYS.has(k)) continue;
    if (JSON.stringify(oldValues[k]) !== JSON.stringify(newValues[k])) {
      diffs.push({ key: k, old: oldValues[k], new: newValues[k] });
    }
  }
  return diffs;
}
