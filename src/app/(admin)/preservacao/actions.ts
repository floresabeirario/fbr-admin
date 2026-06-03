"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireUser } from "@/lib/auth/server";
import { generateUniqueCouponCode } from "@/lib/coupon";
import { computePricingSnapshot } from "@/lib/pricing";
import { buildProductionCostSnapshot } from "@/lib/production-cost";
import type { PricingItem } from "@/types/pricing";
import type { ProductionCostItem } from "@/types/production-cost";
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
import type { OrderInsert, OrderUpdate, OrderStatus, Order, PaymentStatus } from "@/types/database";
import {
  detectTriggeredMoments,
  dueDateFromOffset,
  type CommsMoment,
} from "@/lib/comms-cadence";

// Marca um vale como "preservação agendada" quando uma encomenda passa
// a usar o seu código. Evita dupla contagem na faturação: sem isto, o
// vale (100% pago, "preservação não agendada") continuava a contar para
// receita ao mesmo tempo que a nova encomenda — duplicação na janela em
// que a Maria não actualizava o vale manualmente.
//
// Silencioso em falha — não bloqueia a operação principal. Idempotente:
// o `.neq("usage_status", "preservacao_agendada")` evita writes inúteis.
async function markVoucherAsScheduled(
  // Note: tipo inferido para evitar import circular com supabase/server.
  supabase: Awaited<ReturnType<typeof createClient>>,
  voucherCode: string,
): Promise<void> {
  try {
    const { error } = await supabase
      .from("vouchers")
      .update({ usage_status: "preservacao_agendada" })
      .eq("code", voucherCode)
      .is("deleted_at", null)
      .neq("usage_status", "preservacao_agendada");
    if (error) {
      console.error(
        `[markVoucherAsScheduled] Falhou para código ${voucherCode}:`,
        error.message,
      );
    }
  } catch (err) {
    console.error("[markVoucherAsScheduled] Excepção:", err);
  }
}

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
          pyramid_frame: order.pyramid_frame ?? false,
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

  // ── Snapshot dos custos de produção ───────────────────────────────
  // Não capturamos na criação (decisão Maria 2026-05-22): para reservas
  // com evento a longo prazo (ex.: 2027), os custos podem mudar antes da
  // produção. O snapshot é capturado quando a encomenda passa a 100%
  // pago em `updateOrderAction` — momento em que o negócio "fecha" e os
  // preços são os mais recentes que sabemos.

  const payload: OrderInsert = {
    ...order,
    ...(computedSnapshot
      ? { budget: computedSnapshot.total, pricing_snapshot: computedSnapshot }
      : {}),
    // Default interno: moldura baixa (2x2cm). Maria muda para "caixa" só
    // quando as flores são altas. Garante que os custos de produção ficam
    // logo calculáveis sem precisar de abrir cada encomenda.
    frame_internal_type: order.frame_internal_type ?? "baixa",
  };

  const { data, error } = await supabase
    .from("orders")
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Se a encomenda usa um código de vale-presente, marcar esse vale
  // como "preservação agendada" para evitar dupla contagem na faturação.
  if (payload.gift_voucher_code) {
    await markVoucherAsScheduled(supabase, payload.gift_voucher_code);
    revalidatePath("/vale-presente");
  }

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
        "frame_size, frame_background, pyramid_frame, extra_small_frames, extra_small_frames_qty, christmas_ornaments, christmas_ornaments_qty, necklace_pendants, necklace_pendants_qty",
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

/**
 * Captura os custos de produção vigentes para uma encomenda antiga
 * (criada antes da migração 034) — preenche `production_cost_snapshot`
 * com a tabela actual. Útil quando se quer ver a margem de uma
 * encomenda que ainda não tem snapshot.
 */
export async function captureOrderProductionCostAction(id: string): Promise<Order> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: costRows, error: costErr } = await supabase
    .from("production_cost_items")
    .select("*")
    .is("deleted_at", null);
  if (costErr) throw new Error(costErr.message);
  if (!costRows || costRows.length === 0) {
    throw new Error("Tabela de custos de produção vazia.");
  }

  const snapshot = buildProductionCostSnapshot(costRows as ProductionCostItem[]);
  const { data, error } = await supabase
    .from("orders")
    .update({ production_cost_snapshot: snapshot })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/preservacao/${id}`);
  revalidatePath("/preservacao");
  return data as Order;
}

/**
 * Backfill em massa: preenche `production_cost_snapshot` em encomendas
 * **100% pagas** que ainda não tenham snapshot, usando a tabela de
 * custos actual. Alinhado com a regra "snapshot é capturado no momento
 * de 100% pago" (sessão 91): encomendas em curso ficam sem snapshot
 * (será capturado quando transitarem para 100%).
 *
 * Captura preços de hoje (aproximação para encomendas pré-mig 034 ou
 * que tenham ficado 100% pagas antes desta funcionalidade existir).
 * Cancelado e soft-deleted excluídos.
 *
 * Idempotente: encomendas que já têm snapshot são ignoradas.
 */
export async function backfillProductionCostSnapshotsAction(): Promise<{
  updated: number;
  skipped: number;
}> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: costRows, error: costErr } = await supabase
    .from("production_cost_items")
    .select("*")
    .is("deleted_at", null);
  if (costErr) throw new Error(costErr.message);
  if (!costRows || costRows.length === 0) {
    throw new Error("Tabela de custos de produção vazia.");
  }
  const snapshot = buildProductionCostSnapshot(costRows as ProductionCostItem[]);

  const { data: targets, error: fetchErr } = await supabase
    .from("orders")
    .select("id")
    .is("production_cost_snapshot", null)
    .is("deleted_at", null)
    .eq("payment_status", "100_pago")
    .neq("status", "cancelado");
  if (fetchErr) throw new Error(fetchErr.message);

  const ids = (targets ?? []).map((r) => r.id);
  if (ids.length === 0) {
    return { updated: 0, skipped: 0 };
  }

  const { error: updErr } = await supabase
    .from("orders")
    .update({ production_cost_snapshot: snapshot })
    .in("id", ids);
  if (updErr) throw new Error(updErr.message);

  revalidatePath("/preservacao");
  revalidatePath("/financas");
  return { updated: ids.length, skipped: 0 };
}

export async function updateOrderAction(id: string, updates: OrderUpdate): Promise<Order> {
  await requireAdmin();
  const supabase = await createClient();

  // Ao passar para "A ser emoldurado" → gerar cupão automático (único).
  // Só gera se a encomenda ainda não tem código (idempotente — não cria
  // novo cupão se já foi gerado antes e estamos só a re-passar pelo estado).
  if (updates.status === "a_ser_emoldurado") {
    const { data: existing } = await supabase
      .from("orders")
      .select("coupon_code")
      .eq("id", id)
      .single();
    if (!existing?.coupon_code) {
      updates.coupon_code = await generateUniqueCouponCode(supabase);
      updates.coupon_status = "nao_utilizado";
    }
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
    updates.event_location !== undefined ||
    updates.flower_delivery_method !== undefined ||
    updates.pickup_address !== undefined ||
    updates.pickup_date !== undefined ||
    updates.pickup_time_from !== undefined ||
    updates.pickup_time_to !== undefined ||
    updates.pickup_notes !== undefined ||
    updates.pickup_contact_name !== undefined ||
    updates.pickup_contact_phone !== undefined ||
    updates.hand_delivery_date !== undefined ||
    updates.hand_delivery_time_from !== undefined ||
    updates.hand_delivery_time_to !== undefined ||
    updates.hand_delivery_contact_name !== undefined ||
    updates.hand_delivery_contact_phone !== undefined ||
    updates.hand_delivery_notes !== undefined ||
    updates.email !== undefined ||
    updates.phone !== undefined ||
    updates.contact_preference !== undefined ||
    updates.gift_voucher_code !== undefined ||
    updates.invoice_url_sinal !== undefined ||
    updates.invoice_url_intermedio !== undefined ||
    updates.invoice_url_final !== undefined;

  let triggerDriveCreation = false;
  let calendarAction: "create" | "update" | "delete" | "none" = "none";
  let voucherToMark: string | null = null;
  let captureProductionSnapshot = false;
  // Quais slots de fatura passaram de NULL → URL nesta operação.
  // Cada um cria uma tarefa "Enviar fatura — {nome} (slot)" após o UPDATE.
  const newInvoiceSlots: Array<"sinal" | "intermedio" | "final"> = [];
  // Momentos da cadência de comunicação despoletados por esta transição
  // (ex.: entrar em "Quadro recebido" → lembrete de pedir opinião). Cada
  // um gera 1 tarefa-lembrete após o UPDATE.
  let triggeredMoments: CommsMoment[] = [];
  let prevCommsDone: string[] = [];

  if (needsPrev) {
    const { data: prev } = await supabase
      .from("orders")
      .select(
        "payment_status, status, drive_folder_id, calendar_event_id, event_date, client_name, event_type, couple_names, event_location, flower_delivery_method, pickup_address, pickup_date, pickup_time_from, pickup_time_to, pickup_notes, pickup_contact_name, pickup_contact_phone, hand_delivery_date, hand_delivery_time_from, hand_delivery_time_to, hand_delivery_contact_name, hand_delivery_contact_phone, hand_delivery_notes, email, phone, contact_preference, gift_voucher_code, invoice_url_sinal, invoice_url_intermedio, invoice_url_final, comms_moments_done",
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

      // Vale-presente: se o código foi adicionado ou mudou, marcar o
      // vale como "preservação agendada" depois do UPDATE (anti-dupla
      // contagem na faturação).
      if (
        updates.gift_voucher_code !== undefined &&
        updates.gift_voucher_code &&
        updates.gift_voucher_code !== prev.gift_voucher_code
      ) {
        voucherToMark = updates.gift_voucher_code;
      }

      // Snapshot de custos de produção: capturar na transição para 100%
      // pago (decisão Maria 2026-05-22). Para reservas com evento a
      // longo prazo, isto garante que o COGS usa os preços vigentes no
      // momento em que a encomenda fecha (e não os de quando foi feita).
      if (
        updates.payment_status === "100_pago" &&
        prev.payment_status !== "100_pago"
      ) {
        captureProductionSnapshot = true;
      }

      // Faturas: detectar NULL → URL em qualquer dos 3 slots. Cada
      // transição gera 1 tarefa "Enviar fatura — {nome} ({slot})" após
      // o UPDATE. Substituir um link (URL → outro URL) NÃO conta —
      // assume-se correcção de erro, não fatura nova.
      for (const slot of ["sinal", "intermedio", "final"] as const) {
        const field = `invoice_url_${slot}` as
          | "invoice_url_sinal"
          | "invoice_url_intermedio"
          | "invoice_url_final";
        const next = updates[field];
        if (
          next !== undefined &&
          next !== null &&
          next.trim() !== "" &&
          !prev[field]
        ) {
          newInvoiceSlots.push(slot);
        }
      }

      // Cadência de comunicação: detectar momentos despoletados por esta
      // transição de estado/pagamento (idempotente via comms_moments_done).
      prevCommsDone = (prev.comms_moments_done as string[] | null) ?? [];
      triggeredMoments = detectTriggeredMoments({
        prevStatus: prev.status as OrderStatus | null,
        nextStatus: updates.status,
        prevPayment: prev.payment_status as PaymentStatus | null,
        nextPayment: updates.payment_status,
        alreadyDone: prevCommsDone,
      });

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
            flower_delivery_method: prev.flower_delivery_method as Order["flower_delivery_method"],
            pickup_address: prev.pickup_address as string | null,
            pickup_date: prev.pickup_date as string | null,
            pickup_time_from: prev.pickup_time_from as string | null,
            pickup_time_to: prev.pickup_time_to as string | null,
            pickup_notes: prev.pickup_notes as string | null,
            pickup_contact_name: prev.pickup_contact_name as string | null,
            pickup_contact_phone: prev.pickup_contact_phone as string | null,
            hand_delivery_date: prev.hand_delivery_date as string | null,
            hand_delivery_time_from: prev.hand_delivery_time_from as string | null,
            hand_delivery_time_to: prev.hand_delivery_time_to as string | null,
            hand_delivery_contact_name: prev.hand_delivery_contact_name as string | null,
            hand_delivery_contact_phone: prev.hand_delivery_contact_phone as string | null,
            hand_delivery_notes: prev.hand_delivery_notes as string | null,
            email: prev.email as string | null,
            phone: prev.phone as string | null,
            contact_preference: prev.contact_preference as Order["contact_preference"],
          },
          updates,
        )
      ) {
        calendarAction = "update";
      }
    }
  }

  // Captura o snapshot de custos de produção no momento da transição
  // para 100% pago. Lookup à tabela rosa actual; constrói o snapshot e
  // injecta no payload do UPDATE para ser atómico com a mudança de
  // estado. Em caso de tabela vazia (improvável em produção), loga e
  // segue sem snapshot — não bloqueia a transição de pagamento.
  if (captureProductionSnapshot) {
    const { data: costRows } = await supabase
      .from("production_cost_items")
      .select("*")
      .is("deleted_at", null);
    if (costRows && costRows.length > 0) {
      updates.production_cost_snapshot = buildProductionCostSnapshot(
        costRows as ProductionCostItem[],
      );
    } else {
      console.warn(
        `[updateOrderAction] Transição para 100% pago em ${id} mas tabela de custos de produção está vazia — snapshot não capturado.`,
      );
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
      flower_delivery_method: updatedOrder.flower_delivery_method,
      pickup_address: updatedOrder.pickup_address,
      pickup_date: updatedOrder.pickup_date,
      pickup_time_from: updatedOrder.pickup_time_from,
      pickup_time_to: updatedOrder.pickup_time_to,
      pickup_notes: updatedOrder.pickup_notes,
      pickup_contact_name: updatedOrder.pickup_contact_name,
      pickup_contact_phone: updatedOrder.pickup_contact_phone,
      hand_delivery_date: updatedOrder.hand_delivery_date,
      hand_delivery_time_from: updatedOrder.hand_delivery_time_from,
      hand_delivery_time_to: updatedOrder.hand_delivery_time_to,
      hand_delivery_contact_name: updatedOrder.hand_delivery_contact_name,
      hand_delivery_contact_phone: updatedOrder.hand_delivery_contact_phone,
      hand_delivery_notes: updatedOrder.hand_delivery_notes,
      email: updatedOrder.email,
      phone: updatedOrder.phone,
      contact_preference: updatedOrder.contact_preference,
    });
  } else if (calendarAction === "delete") {
    await deleteOrderCalendarEvent({
      id: updatedOrder.id,
      calendar_event_id: updatedOrder.calendar_event_id,
    });
  }

  if (voucherToMark) {
    await markVoucherAsScheduled(supabase, voucherToMark);
    revalidatePath("/vale-presente");
  }

  // Criar tarefas "Enviar fatura — {nome} ({slot})" para cada link de
  // fatura que acabou de ser preenchido (mig 060). Sem prazo, prioridade
  // alta, categoria administrativo, ligadas à encomenda. Silencioso em
  // falha — não pode bloquear o UPDATE.
  if (newInvoiceSlots.length > 0) {
    const { data: { user } } = await supabase.auth.getUser();
    const slotLabel: Record<"sinal" | "intermedio" | "final", string> = {
      sinal: "sinal",
      intermedio: "intermédio",
      final: "final",
    };
    const tasks = newInvoiceSlots.map((slot) => ({
      title: `Enviar fatura — ${updatedOrder.client_name} (${slotLabel[slot]})`,
      category: "administrativo" as const,
      priority: "alta" as const,
      status: "por_comecar" as const,
      assignee_emails: user?.email ? [user.email] : [],
      order_id: updatedOrder.id,
      created_by: user?.id ?? null,
    }));
    const { error: taskErr } = await supabase.from("tasks").insert(tasks);
    if (taskErr) {
      console.error(
        `[updateOrderAction] Falhou criar tarefa(s) de envio de fatura para encomenda ${id}:`,
        taskErr.message,
      );
    } else {
      revalidatePath("/");
    }
  }

  // Cadência de comunicação: criar 1 tarefa-lembrete por momento
  // despoletado (ex.: "Pedir opinião sobre o quadro" 2 dias após a
  // encomenda entrar em "Quadro recebido"). NADA é enviado — a tarefa
  // só lembra e o picker de templates dá a mensagem pronta. Silencioso
  // em falha; só marca o momento como feito se a tarefa for criada, para
  // não ficar por lembrar.
  if (triggeredMoments.length > 0) {
    const { data: { user } } = await supabase.auth.getUser();
    const tasks = triggeredMoments.map((m) => ({
      title: m.taskTitle(updatedOrder.client_name),
      category: m.category,
      priority: m.priority,
      status: "por_comecar" as const,
      due_date: dueDateFromOffset(m.dueOffsetDays),
      assignee_emails: [...m.assignees],
      order_id: updatedOrder.id,
      created_by: user?.id ?? null,
    }));
    const { error: cadErr } = await supabase.from("tasks").insert(tasks);
    if (cadErr) {
      console.error(
        `[updateOrderAction] Falhou criar tarefa(s) de cadência para encomenda ${id}:`,
        cadErr.message,
      );
    } else {
      // Marca os momentos como gerados (idempotência).
      const newDone = [...prevCommsDone, ...triggeredMoments.map((m) => m.key)];
      const { error: markErr } = await supabase
        .from("orders")
        .update({ comms_moments_done: newDone })
        .eq("id", id);
      if (markErr) {
        console.error(
          `[updateOrderAction] Falhou marcar momentos de cadência em ${id}:`,
          markErr.message,
        );
      }
      revalidatePath("/");
    }
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
      "id, order_id, client_name, event_date, event_type, event_location, couple_names, calendar_event_id, status, flower_delivery_method, pickup_address, pickup_date, pickup_time_from, pickup_time_to, pickup_notes, pickup_contact_name, pickup_contact_phone, hand_delivery_date, hand_delivery_time_from, hand_delivery_time_to, hand_delivery_contact_name, hand_delivery_contact_phone, hand_delivery_notes, email, phone, contact_preference",
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
    flower_delivery_method: data.flower_delivery_method as Order["flower_delivery_method"],
    pickup_address: data.pickup_address as string | null,
    pickup_date: data.pickup_date as string | null,
    pickup_time_from: data.pickup_time_from as string | null,
    pickup_time_to: data.pickup_time_to as string | null,
    pickup_notes: data.pickup_notes as string | null,
    pickup_contact_name: data.pickup_contact_name as string | null,
    pickup_contact_phone: data.pickup_contact_phone as string | null,
    hand_delivery_date: data.hand_delivery_date as string | null,
    hand_delivery_time_from: data.hand_delivery_time_from as string | null,
    hand_delivery_time_to: data.hand_delivery_time_to as string | null,
    hand_delivery_contact_name: data.hand_delivery_contact_name as string | null,
    hand_delivery_contact_phone: data.hand_delivery_contact_phone as string | null,
    hand_delivery_notes: data.hand_delivery_notes as string | null,
    email: data.email as string | null,
    phone: data.phone as string | null,
    contact_preference: data.contact_preference as Order["contact_preference"],
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

// Marca uma encomenda como "vista" pelo utilizador actual (acrescenta o
// email do JWT ao array seen_by). Usado ao abrir o workbench pela 1ª
// vez. Suporta admin E viewer (Ana também precisa de marcar como lida
// para si própria). A RPC mark_order_seen (mig 047) é SECURITY DEFINER
// e tem a sua própria lista de emails permitidos. Silencioso em falha
// — abrir o workbench não pode falhar por causa disto.
export async function markOrderSeenAction(id: string): Promise<void> {
  try {
    await requireUser();
    const supabase = await createClient();
    const { error } = await supabase.rpc("mark_order_seen", { p_order_id: id });
    if (error) console.error("[markOrderSeenAction] RPC falhou:", error.message);
  } catch (err) {
    console.error("[markOrderSeenAction] Excepção:", err);
  }
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
