import { createClient } from "@/lib/supabase/server";
import { getCurrentEmail } from "@/lib/auth/server";
import type { Idea } from "@/types/idea";
import IdeiasClient from "./ideias-client";

export const dynamic = "force-dynamic";

export default async function IdeiasPage() {
  const supabase = await createClient();
  const email = await getCurrentEmail();

  const { data } = await supabase
    .from("ideas")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const ideas: Idea[] = (data ?? []) as Idea[];

  return <IdeiasClient initialIdeas={ideas} currentEmail={email} />;
}
