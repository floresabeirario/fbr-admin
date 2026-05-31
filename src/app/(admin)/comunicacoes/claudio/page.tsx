import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import type { SystemSetting, SystemSettingKey } from "@/types/message-template";
import { USD_TO_EUR } from "@/lib/claude";
import ClaudioClient from "./claudio-client";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const role = await getCurrentRole();
  if (role !== "admin") {
    redirect("/");
  }

  const supabase = await createClient();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [settingsRes, tplCountRes, convsCountRes, monthUsageRes, weekUsageRes] = await Promise.all([
    supabase.from("system_settings").select("key, value, updated_at, updated_by"),
    supabase
      .from("message_templates")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("whatsapp_conversations")
      .select("id, notes", { count: "exact" })
      .not("notes", "is", null),
    supabase
      .from("claude_usage")
      .select("cost_usd")
      .gte("called_at", monthStart),
    supabase
      .from("claude_usage")
      .select("cost_usd")
      .gte("called_at", sevenDaysAgo),
  ]);

  const settings = (settingsRes.data ?? []) as SystemSetting[];
  const settingsMap = Object.fromEntries(
    settings.map((s) => [s.key as SystemSettingKey, s.value]),
  ) as Partial<Record<SystemSettingKey, string>>;

  const templatesCount = tplCountRes.count ?? 0;
  const conversationsWithNotes = (convsCountRes.data ?? []).filter(
    (c) => ((c as { notes: string | null }).notes ?? "").trim() !== "",
  ).length;

  const monthRows = (monthUsageRes.data ?? []) as Array<{ cost_usd: number }>;
  const weekRows = (weekUsageRes.data ?? []) as Array<{ cost_usd: number }>;
  const monthUsd = monthRows.reduce((sum, r) => sum + Number(r.cost_usd), 0);
  const weekUsd = weekRows.reduce((sum, r) => sum + Number(r.cost_usd), 0);

  return (
    <ClaudioClient
      initialPersona={settingsMap.claude_persona ?? ""}
      initialFacts={settingsMap.claude_facts ?? ""}
      templatesCount={templatesCount}
      conversationsWithNotes={conversationsWithNotes}
      cost={{
        monthEur: monthUsd * USD_TO_EUR,
        weekEur: weekUsd * USD_TO_EUR,
        monthCalls: monthRows.length,
        weekCalls: weekRows.length,
      }}
    />
  );
}
