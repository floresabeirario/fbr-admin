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
    // select("*") de propósito (sessão 174): as colunas da mig 111
    // (deposit_paid_at…) podem ainda não existir quando este código chega
    // a produção; com "*" a página não rebenta e o código trata a ausência
    // como "sem data".
    supabase
      .from("orders")
      .select("*")
      .is("deleted_at", null),
    supabase
      .from("vouchers")
      .select("id, code, created_at, amount, payment_status, usage_status, partner_commission, partner_commission_status")
      .is("deleted_at", null),
  ]);

  const competitors: Competitor[] = (competitorsRes.data ?? []) as Competitor[];
  const pricing: PricingItem[] = (pricingRes.data ?? []) as PricingItem[];
  const productionCosts: ProductionCostItem[] = (productionCostRes.data ?? []) as ProductionCostItem[];
  const expenses: Expense[] = (expensesRes.data ?? []) as Expense[];
  const orders = (ordersRes.data ?? []) as Order[];
  const vouchers = (vouchersRes.data ?? []) as Pick<Voucher, "id" | "code" | "created_at" | "amount" | "payment_status" | "usage_status" | "partner_commission" | "partner_commission_status">[];

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
