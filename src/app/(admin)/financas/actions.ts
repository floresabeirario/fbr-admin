"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, getCurrentEmail } from "@/lib/auth/server";
import { uploadExpenseInvoice } from "@/lib/google/drive";
import type {
  Competitor,
  CompetitorInsert,
  CompetitorUpdate,
} from "@/types/competitor";
import type { PricingItem, PricingItemUpdate } from "@/types/pricing";
import type {
  ProductionCostItem,
  ProductionCostItemUpdate,
  ProductionConsumableInsert,
} from "@/types/production-cost";
import type { Expense, ExpenseInsert, ExpenseUpdate } from "@/types/expense";
import { subscriptionSplitDates } from "@/types/expense";

// Aba Finanças → Competição: só admin escreve. A Ana lê.

export async function createCompetitorAction(
  input: CompetitorInsert,
): Promise<Competitor> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitors")
    .insert({
      websites: [],
      prices: [],
      country: "PT",
      ...input,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
  return data as Competitor;
}

export async function updateCompetitorAction(
  id: string,
  updates: CompetitorUpdate,
): Promise<Competitor> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitors")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
  return data as Competitor;
}

export async function archiveCompetitorAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("competitors")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
}

// ============================================================
// PRICING ITEMS — Tabela de preços (cálculo automático do orçamento)
// ============================================================

export async function updatePricingItemAction(
  id: string,
  updates: PricingItemUpdate,
): Promise<PricingItem> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pricing_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
  return data as PricingItem;
}

// ============================================================
// PRODUCTION COST ITEMS — Custos de produção (COGS) por quadro
// ============================================================

export async function updateProductionCostItemAction(
  id: string,
  updates: ProductionCostItemUpdate,
): Promise<ProductionCostItem> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("production_cost_items")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
  return data as ProductionCostItem;
}

/**
 * Adiciona uma nova linha de consumível. Cria 6 entradas em simultâneo
 * (uma por produto vendável): 30x40, 40x50, 50x70, mini_20x25,
 * christmas_ornament, necklace_pendant. Todos com cost=0; o admin edita
 * a seguir os valores que se aplicam (deixa 0 onde o consumível não
 * é usado).
 */
export async function createConsumableAction(
  label: string,
): Promise<ProductionCostItem[]> {
  await requireAdmin();
  const trimmed = label.trim();
  if (trimmed.length < 1) throw new Error("Nome obrigatório.");

  const supabase = await createClient();
  const rows: Array<
    ProductionConsumableInsert & { kind: "consumable" }
  > = [
    { kind: "consumable", size_key: "30x40",              label: trimmed, cost: 0 },
    { kind: "consumable", size_key: "40x50",              label: trimmed, cost: 0 },
    { kind: "consumable", size_key: "50x70",              label: trimmed, cost: 0 },
    { kind: "consumable", size_key: "mini_20x25",         label: trimmed, cost: 0 },
    { kind: "consumable", size_key: "christmas_ornament", label: trimmed, cost: 0 },
    { kind: "consumable", size_key: "necklace_pendant",   label: trimmed, cost: 0 },
  ];
  const { data, error } = await supabase
    .from("production_cost_items")
    .insert(rows)
    .select();
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
  return (data ?? []) as ProductionCostItem[];
}

/**
 * Arquiva (soft-delete) um consumível em TODOS os tamanhos — input é o
 * label do item porque a Maria pensa "remover Caixa de cartão", não
 * "remover linha de Caixa do 30x40". Faz delete às 3 linhas atómicamente.
 */
export async function archiveConsumableAction(label: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("production_cost_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("kind", "consumable")
    .eq("label", label)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
}

/**
 * Renomeia um consumível em todos os tamanhos atómicamente.
 */
export async function renameConsumableAction(
  oldLabel: string,
  newLabel: string,
): Promise<void> {
  await requireAdmin();
  const trimmed = newLabel.trim();
  if (trimmed.length < 1) throw new Error("Nome obrigatório.");
  if (trimmed === oldLabel) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("production_cost_items")
    .update({ label: trimmed })
    .eq("kind", "consumable")
    .eq("label", oldLabel)
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
}

// ============================================================
// DESPESAS — só admin escreve, Ana lê
// ============================================================

export async function createExpenseAction(input: ExpenseInsert): Promise<Expense> {
  await requireAdmin();
  const email = await getCurrentEmail();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .insert({ ...input, created_by_email: email })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
  return data as Expense;
}

export async function updateExpenseAction(
  id: string,
  updates: ExpenseUpdate,
): Promise<Expense> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
  return data as Expense;
}

/**
 * Muda o valor de uma subscrição A PARTIR de um mês, sem tocar no
 * histórico (sessão 174, pedido da Maria: "contabilizar a partir daquela
 * data" em vez de fechar uma e abrir outra à mão). Faz os dois passos:
 *   1. cria uma subscrição nova igual à antiga, com o valor novo, a
 *      começar no dia 1 de `fromMonth` (e o mesmo fim, se a antiga tinha);
 *   2. termina a antiga no último dia do mês anterior.
 * `patch` (descrição, categoria, fornecedor, notas, método) aplica-se às
 * duas, para a lista continuar coerente. Se o passo 2 falhar, a nova é
 * arquivada para não ficar a contar a dobrar.
 */
export async function changeSubscriptionAmountFromAction(
  id: string,
  newAmount: number,
  fromMonth: string,
  patch: Pick<ExpenseUpdate, "description" | "category" | "supplier" | "notes" | "payment_method">,
): Promise<{ oldId: string; newId: string }> {
  await requireAdmin();
  const email = await getCurrentEmail();
  const supabase = await createClient();

  const { data: old, error: loadError } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (loadError || !old) throw new Error(loadError?.message ?? "Subscrição não encontrada.");
  const oldExp = old as Expense;
  if (!oldExp.is_recurring || !oldExp.recurrence_start_date) {
    throw new Error("Só se aplica a subscrições.");
  }
  if (oldExp.recurrence_period === "custom") {
    throw new Error("Numa subscrição de intervalo específico o valor é o total do intervalo; edita-o directamente.");
  }

  const { oldEnd, newStart } = subscriptionSplitDates(fromMonth);
  if (newStart <= oldExp.recurrence_start_date) {
    throw new Error("O mês escolhido tem de ser depois do início da subscrição. Para corrigir todos os meses, apaga a data.");
  }
  if (oldExp.recurrence_end_date && oldExp.recurrence_end_date < newStart) {
    throw new Error("A subscrição já tinha terminado antes desse mês.");
  }

  const { data: created, error: insertError } = await supabase
    .from("expenses")
    .insert({
      expense_date: newStart,
      supplier: patch.supplier ?? oldExp.supplier,
      category: patch.category ?? oldExp.category,
      description: patch.description ?? oldExp.description ?? "",
      amount: newAmount,
      vat_rate: oldExp.vat_rate,
      payment_method: patch.payment_method ?? oldExp.payment_method,
      has_invoice: false,
      invoice_url: null,
      notes: patch.notes ?? oldExp.notes,
      is_recurring: true,
      recurrence_period: oldExp.recurrence_period,
      recurrence_start_date: newStart,
      recurrence_end_date: oldExp.recurrence_end_date,
      created_by_email: email,
    })
    .select("id")
    .single();
  if (insertError || !created) throw new Error(insertError?.message ?? "Erro ao criar a subscrição nova.");

  const { error: updateError } = await supabase
    .from("expenses")
    .update({ ...patch, recurrence_end_date: oldEnd })
    .eq("id", id);
  if (updateError) {
    await supabase
      .from("expenses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", created.id);
    throw new Error(updateError.message);
  }

  revalidatePath("/financas");
  return { oldId: id, newId: created.id as string };
}

export async function archiveExpenseAction(id: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financas");
}

/**
 * Upload de uma factura para a Drive (pasta Despesas/{ano}/) e guarda o
 * URL na linha da despesa. Aceita FormData com campos:
 *   - expense_id (UUID da despesa)
 *   - file (File)
 */
export async function uploadExpenseInvoiceAction(formData: FormData): Promise<{
  url: string;
}> {
  await requireAdmin();
  const expenseId = String(formData.get("expense_id") ?? "");
  const file = formData.get("file");
  if (!expenseId || !(file instanceof File)) {
    throw new Error("Faltam dados: expense_id ou file.");
  }
  if (file.size === 0) {
    throw new Error("Ficheiro vazio.");
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error("Ficheiro demasiado grande (limite 25 MB).");
  }

  const supabase = await createClient();
  const { data: expense, error: fetchErr } = await supabase
    .from("expenses")
    .select("expense_date, supplier, description")
    .eq("id", expenseId)
    .single();
  if (fetchErr || !expense) {
    throw new Error("Despesa não encontrada.");
  }

  // Fornecedor agora é opcional — usa a descrição como fallback
  // para o nome do ficheiro no Drive ficar identificável.
  const folderLabel =
    (expense.supplier ?? "").trim() ||
    (expense.description ?? "").trim() ||
    "sem-fornecedor";

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadExpenseInvoice({
    expenseDate: expense.expense_date,
    supplier: folderLabel,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    buffer,
  });

  const { error: updErr } = await supabase
    .from("expenses")
    .update({ invoice_url: uploaded.url, has_invoice: true })
    .eq("id", expenseId);
  if (updErr) throw new Error(updErr.message);

  revalidatePath("/financas");
  return { url: uploaded.url };
}

