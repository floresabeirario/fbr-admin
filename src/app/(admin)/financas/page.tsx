import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import type { Competitor } from "@/types/competitor";
import FinancasClient from "./financas-client";

export const dynamic = "force-dynamic";

export default async function FinancasPage() {
  const supabase = await createClient();
  const role = await getCurrentRole();
  const canEdit = role === "admin";

  const { data } = await supabase
    .from("competitors")
    .select("*")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const competitors: Competitor[] = (data ?? []) as Competitor[];

  return <FinancasClient initialCompetitors={competitors} canEdit={canEdit} />;
}
