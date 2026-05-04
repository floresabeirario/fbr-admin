"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
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
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    updates.coupon_code = code;
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
