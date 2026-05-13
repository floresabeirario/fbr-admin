"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import { generateCouponCode } from "@/lib/coupon";
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

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/preservacao");
  return data as Order;
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
