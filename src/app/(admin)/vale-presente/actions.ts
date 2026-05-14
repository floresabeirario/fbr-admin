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
  let triggerDriveCreation = false;
  if (updates.payment_status !== undefined) {
    const { data: prev } = await supabase
      .from("vouchers")
      .select("payment_status, drive_folder_id")
      .eq("id", id)
      .single();
    if (
      prev &&
      !prev.drive_folder_id &&
      isFirstVoucherPayment(prev.payment_status as Voucher["payment_status"], updates.payment_status)
    ) {
      triggerDriveCreation = true;
    }
  }

  const { data, error } = await supabase
    .from("vouchers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (triggerDriveCreation) {
    const updatedVoucher = data as Voucher;
    await createVoucherDriveFolderIfNeeded({
      id: updatedVoucher.id,
      sender_name: updatedVoucher.sender_name,
      created_at: updatedVoucher.created_at,
      drive_folder_id: updatedVoucher.drive_folder_id,
    });
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
