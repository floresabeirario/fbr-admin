"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export async function anonymizeOrderAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("anonymize_order", { p_order_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/rgpd");
  revalidatePath("/preservacao");
  revalidatePath(`/preservacao/${id}`);
}

export async function anonymizeVoucherAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("anonymize_voucher", { p_voucher_id: id });
  if (error) throw new Error(error.message);
  revalidatePath("/settings/rgpd");
  revalidatePath("/vale-presente");
}

/**
 * DELETE definitivo de uma encomenda (Art. 17 RGPD — direito ao
 * esquecimento). Em geral preferir anonimizar para não corromper
 * métricas; este action é para pedidos explícitos do titular.
 *
 * Requer justificação ≥3 chars (igual ao hardDeleteOrderAction
 * existente em preservacao/actions.ts), logo do audit_log antes
 * do DELETE para deixar registo da decisão.
 */
export async function hardDeleteOrderForRgpdAction(
  id: string,
  justification: string,
): Promise<void> {
  await requireAdmin();
  if (!justification || justification.trim().length < 3) {
    throw new Error("Justificação obrigatória (mín. 3 caracteres).");
  }
  const supabase = await createClient();
  await supabase.from("audit_log").insert({
    table_name: "orders",
    record_id: id,
    action: "DELETE",
    new_values: { rgpd_hard_delete_justification: justification },
  });
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/rgpd");
  revalidatePath("/preservacao");
}

export async function hardDeleteVoucherForRgpdAction(
  id: string,
  justification: string,
): Promise<void> {
  await requireAdmin();
  if (!justification || justification.trim().length < 3) {
    throw new Error("Justificação obrigatória (mín. 3 caracteres).");
  }
  const supabase = await createClient();
  await supabase.from("audit_log").insert({
    table_name: "vouchers",
    record_id: id,
    action: "DELETE",
    new_values: { rgpd_hard_delete_justification: justification },
  });
  const { error } = await supabase.from("vouchers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/rgpd");
  revalidatePath("/vale-presente");
}
