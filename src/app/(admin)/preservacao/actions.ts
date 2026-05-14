"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import { generateCouponCode } from "@/lib/coupon";
import {
  createOrderDriveFolderIfNeeded,
  isFirstOrderPayment,
} from "@/lib/google/order-drive-trigger";
import type { OrderInsert, OrderUpdate, OrderStatus, Order } from "@/types/database";

export async function createOrderAction(order: OrderInsert): Promise<Order> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .insert(order)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/preservacao");
  return data as Order;
}

export async function updateOrderAction(id: string, updates: OrderUpdate): Promise<Order> {
  await requireAdmin();
  const supabase = await createClient();

  // Ao passar para "A ser emoldurado" → gerar cupão automático
  if (updates.status === "a_ser_emoldurado") {
    updates.coupon_code = generateCouponCode();
    updates.coupon_status = "nao_utilizado";
  }

  // Detectar 1º pagamento ANTES do update para podermos comparar
  // (precisamos do payment_status anterior). Só fetch quando relevante.
  let triggerDriveCreation = false;
  if (updates.payment_status !== undefined) {
    const { data: prev } = await supabase
      .from("orders")
      .select("payment_status, drive_folder_id")
      .eq("id", id)
      .single();
    if (
      prev &&
      !prev.drive_folder_id &&
      isFirstOrderPayment(prev.payment_status as Order["payment_status"], updates.payment_status)
    ) {
      triggerDriveCreation = true;
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (triggerDriveCreation) {
    const updatedOrder = data as Order;
    // Não bloqueia o response perante falha — só loga (ver helper).
    await createOrderDriveFolderIfNeeded({
      id: updatedOrder.id,
      client_name: updatedOrder.client_name,
      event_date: updatedOrder.event_date,
      drive_folder_id: updatedOrder.drive_folder_id,
    });
  }

  revalidatePath("/preservacao");
  return data as Order;
}

/**
 * Cria/garante a pasta da encomenda na Drive manualmente (botão no
 * workbench). Útil para encomendas antigas ou para retentar após erro.
 */
export async function createOrderDriveFolderAction(id: string): Promise<{
  url: string;
} | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, client_name, event_date, drive_folder_id")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const folder = await createOrderDriveFolderIfNeeded({
    id: data.id as string,
    client_name: data.client_name as string,
    event_date: data.event_date as string | null,
    drive_folder_id: null, // forçar criação mesmo se já existia (idempotente: reutiliza)
  });
  revalidatePath("/preservacao");
  revalidatePath(`/preservacao/${id}`);
  return folder ? { url: folder.url } : null;
}

export async function deleteOrderAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/preservacao");
}

export async function restoreOrderAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ deleted_at: null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/preservacao");
}

export async function hardDeleteOrderAction(
  id: string,
  justification: string,
): Promise<void> {
  await requireAdmin();
  const reason = justification.trim();
  if (reason.length < 3) {
    throw new Error("Justificação obrigatória (mínimo 3 caracteres).");
  }
  const supabase = await createClient();
  // Audit log trigger automaticamente regista o DELETE com old_values.
  // Aqui guardamos a justificação como nota separada antes do DELETE.
  await supabase.from("audit_log").insert({
    table_name: "orders",
    record_id: id,
    action: "DELETE",
    new_values: { justification: reason },
  });
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/preservacao");
}
