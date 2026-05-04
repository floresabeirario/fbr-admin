"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OrderUpdate, Order } from "@/types/database";
import type { PartialPublicMessages } from "@/lib/public-status";

export async function updateOrderPublicStatusAction(
  id: string,
  updates: Pick<
    OrderUpdate,
    | "public_status_message_pt"
    | "public_status_message_en"
    | "public_status_language"
    | "estimated_delivery_date"
  >,
): Promise<Order> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/status");
  revalidatePath("/preservacao");
  return data as Order;
}

export async function updateDefaultMessagesAction(
  messages: PartialPublicMessages,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("public_status_settings")
    .upsert({ id: 1, messages, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/status");
  revalidatePath("/status/mensagens-default");
}
