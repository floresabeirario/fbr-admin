import { createClient } from "@/lib/supabase/server";
import { getCurrentEmail } from "@/lib/auth/server";
import type { Recipe } from "@/types/recipe";
import LivroReceitasClient from "./livro-receitas-client";

export const dynamic = "force-dynamic";

export default async function LivroReceitasPage() {
  const supabase = await createClient();
  const email = await getCurrentEmail();

  const { data } = await supabase
    .from("recipes")
    .select("*")
    .is("deleted_at", null)
    .order("flower_name", { ascending: true });

  const recipes: Recipe[] = (data ?? []) as Recipe[];

  return <LivroReceitasClient initialRecipes={recipes} currentEmail={email} />;
}
