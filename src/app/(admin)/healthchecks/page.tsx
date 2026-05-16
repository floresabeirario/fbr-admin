import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { runHealthchecks } from "@/lib/healthchecks";
import HealthchecksClient from "./healthchecks-client";

export const dynamic = "force-dynamic";

// Re-exporta o tipo para que o client component continue a importar daqui.
export type { HealthCheck } from "@/lib/healthchecks";

export default async function HealthchecksPage() {
  const role = await getCurrentRole();
  if (role !== "admin") redirect("/");

  const supabase = await createClient();
  const checks = await runHealthchecks(supabase);
  return <HealthchecksClient checks={checks} generatedAt={new Date().toISOString()} />;
}
