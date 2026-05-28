"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import {
  createVoucherDriveFolderIfNeeded,
  isFirstVoucherPayment,
} from "@/lib/google/order-drive-trigger";
import type { Voucher, VoucherInsert, VoucherUpdate } from "@/types/voucher";

export async function createVoucherAction(voucher: VoucherInsert): Promise<Voucher> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vouchers")
    .insert(voucher)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/vale-presente");
  return data as Voucher;
}

export async function updateVoucherAction(
  id: string,
  updates: VoucherUpdate,
): Promise<Voucher> {
  await requireAdmin();
  const supabase = await createClient();

  // 1º pagamento → criar pasta na Drive
  // Detectar também NULL → URL em invoice_attachment_url para criar a
  // tarefa "Enviar fatura" automaticamente.
  let triggerDriveCreation = false;
  let newInvoiceLink = false;
  const needsPrev =
    updates.payment_status !== undefined ||
    updates.invoice_attachment_url !== undefined;
  if (needsPrev) {
    const { data: prev } = await supabase
      .from("vouchers")
      .select("payment_status, drive_folder_id, invoice_attachment_url")
      .eq("id", id)
      .single();
    if (prev) {
      if (
        !prev.drive_folder_id &&
        updates.payment_status !== undefined &&
        isFirstVoucherPayment(prev.payment_status as Voucher["payment_status"], updates.payment_status)
      ) {
        triggerDriveCreation = true;
      }
      if (
        updates.invoice_attachment_url !== undefined &&
        updates.invoice_attachment_url !== null &&
        updates.invoice_attachment_url.trim() !== "" &&
        !prev.invoice_attachment_url
      ) {
        newInvoiceLink = true;
      }
    }
  }

  const { data, error } = await supabase
    .from("vouchers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  const updatedVoucher = data as Voucher;

  if (triggerDriveCreation) {
    await createVoucherDriveFolderIfNeeded({
      id: updatedVoucher.id,
      sender_name: updatedVoucher.sender_name,
      created_at: updatedVoucher.created_at,
      drive_folder_id: updatedVoucher.drive_folder_id,
    });
  }

  // Tarefa "Enviar fatura — {sender_name}" ligada ao vale (mig 060).
  // Sem prazo, prioridade alta, categoria administrativo. Silencioso em
  // falha — não pode bloquear o UPDATE.
  if (newInvoiceLink) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error: taskErr } = await supabase.from("tasks").insert({
      title: `Enviar fatura — ${updatedVoucher.sender_name}`,
      category: "administrativo",
      priority: "alta",
      status: "por_comecar",
      assignee_emails: user?.email ? [user.email] : [],
      voucher_id: updatedVoucher.id,
      created_by: user?.id ?? null,
    });
    if (taskErr) {
      console.error(
        `[updateVoucherAction] Falhou criar tarefa de envio de fatura para vale ${id}:`,
        taskErr.message,
      );
    } else {
      revalidatePath("/");
    }
  }

  revalidatePath("/vale-presente");
  revalidatePath(`/vale-presente/${id}`);
  return data as Voucher;
}

/**
 * Cria/garante a pasta do vale na Drive manualmente.
 */
export async function createVoucherDriveFolderAction(id: string): Promise<{
  url: string;
} | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vouchers")
    .select("id, sender_name, created_at, drive_folder_id")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const folder = await createVoucherDriveFolderIfNeeded({
    id: data.id as string,
    sender_name: data.sender_name as string,
    created_at: data.created_at as string | null,
    drive_folder_id: null,
  });
  revalidatePath("/vale-presente");
  revalidatePath(`/vale-presente/${id}`);
  return folder ? { url: folder.url } : null;
}

export async function deleteVoucherAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("vouchers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vale-presente");
}

export async function restoreVoucherAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("vouchers")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vale-presente");
}

export async function hardDeleteVoucherAction(
  id: string,
  justification: string,
): Promise<void> {
  await requireAdmin();
  const reason = justification.trim();
  if (reason.length < 3) {
    throw new Error("Justificação obrigatória (mínimo 3 caracteres).");
  }
  const supabase = await createClient();
  await supabase.from("audit_log").insert({
    table_name: "vouchers",
    record_id: id,
    action: "DELETE",
    new_values: { justification: reason },
  });
  const { error } = await supabase.from("vouchers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/vale-presente");
}
