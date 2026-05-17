import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { runHealthchecks } from "@/lib/healthchecks";
import { HEALTHCHECK_STATUS_KEY, summariseHealthchecks } from "@/lib/healthcheck-cache";
import HealthchecksClient from "./healthchecks-client";

export const dynamic = "force-dynamic";

// Re-exporta o tipo para que o client component continue a importar daqui.
export type { HealthCheck } from "@/lib/healthchecks";

export default async function HealthchecksPage() {
  const role = await getCurrentRole();
  if (role !== "admin") redirect("/");

  const supabase = await createClient();
  const checks = await runHealthchecks(supabase);

  // Aproveita esta corrida para refrescar a cache lida pela bolinha na sidebar.
  // Maria é admin → RLS de system_settings permite escrita.
  const summary = summariseHealthchecks(checks);
  await supabase
    .from("system_settings")
    .upsert({ key: HEALTHCHECK_STATUS_KEY, value: JSON.stringify(summary) });

  return <HealthchecksClient checks={checks} generatedAt={new Date().toISOString()} />;
}
