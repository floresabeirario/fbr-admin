"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
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
  const { data, error } = await supabase
    .from("vouchers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/vale-presente");
  revalidatePath(`/vale-presente/${id}`);
  return data as Voucher;
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
