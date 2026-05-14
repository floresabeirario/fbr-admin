import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import type { Competitor } from "@/types/competitor";
import type { PricingItem } from "@/types/pricing";
import FinancasClient from "./financas-client";

export const dynamic = "force-dynamic";

export default async function FinancasPage() {
  const supabase = await createClient();
  const role = await getCurrentRole();
  const canEdit = role === "admin";

  const [competitorsRes, pricingRes] = await Promise.all([
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
  ]);

  const competitors: Competitor[] = (competitorsRes.data ?? []) as Competitor[];
  const pricing: PricingItem[] = (pricingRes.data ?? []) as PricingItem[];

  return (
    <FinancasClient
      initialCompetitors={competitors}
      initialPricing={pricing}
      canEdit={canEdit}
    />
  );
}
