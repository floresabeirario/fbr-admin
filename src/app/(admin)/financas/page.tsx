import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import type { Competitor } from "@/types/competitor";
import type { PricingItem } from "@/types/pricing";
import type { ProductionCostItem } from "@/types/production-cost";
import type { Expense } from "@/types/expense";
import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import FinancasClient from "./financas-client";

export const dynamic = "force-dynamic";

export default async function FinancasPage() {
  const supabase = await createClient();
  const role = await getCurrentRole();
  const canEdit = role === "admin";

  const [competitorsRes, pricingRes, productionCostRes, expensesRes, ordersRes, vouchersRes] = await Promise.all([
    supabase
      .from("competitors")
      .select("*")
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("pricing_items")
      .select("*")
      .is("deleted_at", null)
      .order("category", { ascending: true })
      .order("position", { ascending: true }),
    supabase
      .from("production_cost_items")
      .select("*")
      .is("deleted_at", null)
      .order("position", { ascending: true }),
    supabase
      .from("expenses")
      .select("*")
      .is("deleted_at", null)
      .order("expense_date", { ascending: false }),
    supabase
      .from("orders")
      .select("id, order_id, created_at, status, payment_status, budget, frame_delivery_date")
      .is("deleted_at", null),
    supabase
      .from("vouchers")
      .select("id, code, created_at, amount, payment_status, usage_status")
      .is("deleted_at", null),
  ]);

  const competitors: Competitor[] = (competitorsRes.data ?? []) as Competitor[];
  const pricing: PricingItem[] = (pricingRes.data ?? []) as PricingItem[];
  const productionCosts: ProductionCostItem[] = (productionCostRes.data ?? []) as ProductionCostItem[];
  const expenses: Expense[] = (expensesRes.data ?? []) as Expense[];
  const orders = (ordersRes.data ?? []) as Pick<Order, "id" | "order_id" | "created_at" | "status" | "payment_status" | "budget" | "frame_delivery_date">[];
  const vouchers = (vouchersRes.data ?? []) as Pick<Voucher, "id" | "code" | "created_at" | "amount" | "payment_status" | "usage_status">[];

  return (
    <FinancasClient
      initialCompetitors={competitors}
      initialPricing={pricing}
      initialProductionCosts={productionCosts}
      initialExpenses={expenses}
      orders={orders}
      vouchers={vouchers}
      canEdit={canEdit}
    />
  );
}
