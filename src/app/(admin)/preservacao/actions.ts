"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import { generateCouponCode } from "@/lib/coupon";
import { computePricingSnapshot } from "@/lib/pricing";
import type { PricingItem } from "@/types/pricing";
import {
  createOrderDriveFolderIfNeeded,
  isFirstOrderPayment,
} from "@/lib/google/order-drive-trigger";
import {
  calendarFieldsChanged,
  deleteOrderCalendarEvent,
  isFirstOrderPaymentTransition,
  statusBecomesCancelled,
  upsertOrderCalendarEvent,
} from "@/lib/google/order-calendar-trigger";
import type { OrderInsert, OrderUpdate, OrderStatus, Order } from "@/types/database";

export async function createOrderAction(order: OrderInsert): Promise<Order> {
  await requireAdmin();
  const supabase = await createClient();

  // ── Cálculo automático do orçamento (com snapshot dos preços actuais).
  // Aplica-se quando a Maria não pôs um orçamento manual E o cálculo
  // consegue determinar um valor (frame_size definido e não "vocês a
  // escolher"/"não sei"). Em qualquer outro caso o orçamento fica como
  // veio (manual ou NULL).
  let computedSnapshot: ReturnType<typeof computePricingSnapshot> = null;
  if (order.budget === null || order.budget === undefined) {
    const { data: pricingRows } = await supabase
      .from("pricing_items")
      .select("*")
      .is("deleted_at", null);
    if (pricingRows && pricingRows.length > 0) {
      computedSnapshot = computePricingSnapshot(
        {
          frame_size: order.frame_size ?? null,
          frame_background: order.frame_background ?? null,
          extra_small_frames: order.extra_small_frames ?? null,
          extra_small_frames_qty: order.extra_small_frames_qty ?? null,
          christmas_ornaments: order.christmas_ornaments ?? null,
          christmas_ornaments_qty: order.christmas_ornaments_qty ?? null,
          necklace_pendants: order.necklace_pendants ?? null,
          necklace_pendants_qty: order.necklace_pendants_qty ?? null,
        },
        pricingRows as PricingItem[],
      );
    }
  }

  const payload: OrderInsert = computedSnapshot
    ? {
        ...order,
        budget: computedSnapshot.total,
        pricing_snapshot: computedSnapshot,
      }
    : order;

  const { data, error } = await supabase
    .from("orders")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/preservacao");
  return data as Order;
}

/**
 * Re-calcula o snapshot de preços de uma encomenda existente usando os
 * preços actuais da tabela e actualiza `budget` + `pricing_snapshot`.
 * Botão no workbench — útil quando a Maria muda o tamanho/fundo/extras
 * depois de a encomenda já existir, ou quando importou uma encomenda
 * antiga e quer aplicar o cálculo.
 */
export async function recomputeOrderBudgetAction(id: string): Promise<Order> {
  await requireAdmin();
  const supabase = await createClient();

  const [orderRes, pricingRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "frame_size, frame_background, extra_small_frames, extra_small_frames_qty, christmas_ornaments, christmas_ornaments_qty, necklace_pendants, necklace_pendants_qty",
      )
      .eq("id", id)
      .single(),
    supabase.from("pricing_items").select("*").is("deleted_at", null),
  ]);

  if (orderRes.error) throw new Error(orderRes.error.message);
  if (!pricingRes.data || pricingRes.data.length === 0) {
    throw new Error("Tabela de preços vazia. Preenche os valores em Finanças.");
  }

  const snapshot = computePricingSnapshot(
    orderRes.data as Parameters<typeof computePricingSnapshot>[0],
    pricingRes.data as PricingItem[],
  );

  if (!snapshot) {
    throw new Error(
      "Não é possível calcular o orçamento — tamanho da moldura indefinido ou 'vocês a escolher'.",
    );
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ budget: snapshot.total, pricing_snapshot: snapshot })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/preservacao/${id}`);
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

  // Fetch ANTES do update para podermos detectar transições (1º pagamento,
  // cancelamento, mudança de data do evento, etc). Só fazemos o fetch
  // quando algum dos campos relevantes está a ser actualizado.
  const needsPrev =
    updates.payment_status !== undefined ||
    updates.status !== undefined ||
    updates.event_date !== undefined ||
    updates.client_name !== undefined ||
    updates.event_type !== undefined ||
    updates.couple_names !== undefined ||
    updates.event_location !== undefined;

  let triggerDriveCreation = false;
  let calendarAction: "create" | "update" | "delete" | "none" = "none";

  if (needsPrev) {
    const { data: prev } = await supabase
      .from("orders")
      .select(
        "payment_status, status, drive_folder_id, calendar_event_id, event_date, client_name, event_type, couple_names, event_location",
      )
      .eq("id", id)
      .single();

    if (prev) {
      // Drive: 1º pagamento → cria pasta se ainda não existir
      if (
        !prev.drive_folder_id &&
        updates.payment_status !== undefined &&
        isFirstOrderPayment(prev.payment_status as Order["payment_status"], updates.payment_status)
      ) {
        triggerDriveCreation = true;
      }

      // Calendar: decide ordem de prioridade
      //   1. Se vai passar para `cancelado` E existe evento → apagar
      //   2. Se é 1º pagamento → criar (se não houver ainda)
      //   3. Se já existe evento e mudou algum campo visível → actualizar
      if (statusBecomesCancelled(prev.status as Order["status"], updates.status) && prev.calendar_event_id) {
        calendarAction = "delete";
      } else if (
        updates.payment_status !== undefined &&
        isFirstOrderPaymentTransition(prev.payment_status as Order["payment_status"], updates.payment_status) &&
        !prev.calendar_event_id
      ) {
        calendarAction = "create";
      } else if (
        prev.calendar_event_id &&
        calendarFieldsChanged(
          {
            event_date: prev.event_date as string | null,
            client_name: prev.client_name as string,
            event_type: prev.event_type as Order["event_type"],
            couple_names: prev.couple_names as string | null,
            event_location: prev.event_location as string | null,
          },
          updates,
        )
      ) {
        calendarAction = "update";
      }
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  const updatedOrder = data as Order;

  if (triggerDriveCreation) {
    // Não bloqueia o response perante falha — só loga (ver helper).
    await createOrderDriveFolderIfNeeded({
      id: updatedOrder.id,
      client_name: updatedOrder.client_name,
      event_date: updatedOrder.event_date,
      drive_folder_id: updatedOrder.drive_folder_id,
    });
  }

  if (calendarAction === "create" || calendarAction === "update") {
    await upsertOrderCalendarEvent({
      id: updatedOrder.id,
      order_id: updatedOrder.order_id,
      client_name: updatedOrder.client_name,
      event_date: updatedOrder.event_date,
      event_type: updatedOrder.event_type,
      event_location: updatedOrder.event_location,
      couple_names: updatedOrder.couple_names,
      calendar_event_id: updatedOrder.calendar_event_id,
      status: updatedOrder.status,
    });
  } else if (calendarAction === "delete") {
    await deleteOrderCalendarEvent({
      id: updatedOrder.id,
      calendar_event_id: updatedOrder.calendar_event_id,
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

/**
 * Cria/actualiza o evento Calendar de uma encomenda manualmente (botão
 * no workbench). Útil para encomendas antigas, criadas antes da
 * integração existir, ou para retentar após erro.
 */
export async function createOrderCalendarEventAction(id: string): Promise<{
  htmlLink: string | null;
} | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_id, client_name, event_date, event_type, event_location, couple_names, calendar_event_id, status",
    )
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  if (!data.event_date) {
    throw new Error("A encomenda não tem data do evento — preenche primeiro.");
  }

  const result = await upsertOrderCalendarEvent({
    id: data.id as string,
    order_id: data.order_id as string,
    client_name: data.client_name as string,
    event_date: data.event_date as string,
    event_type: data.event_type as Order["event_type"],
    event_location: data.event_location as string | null,
    couple_names: data.couple_names as string | null,
    calendar_event_id: data.calendar_event_id as string | null,
    status: data.status as OrderStatus,
  });
  revalidatePath("/preservacao");
  revalidatePath(`/preservacao/${id}`);
  return result ? { htmlLink: result.htmlLink } : null;
}

/**
 * Apaga o evento Calendar de uma encomenda (botão no workbench).
 */
export async function deleteOrderCalendarEventAction(id: string): Promise<boolean> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, calendar_event_id")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const removed = await deleteOrderCalendarEvent({
    id: data.id as string,
    calendar_event_id: data.calendar_event_id as string | null,
  });
  revalidatePath("/preservacao");
  revalidatePath(`/preservacao/${id}`);
  return removed;
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
