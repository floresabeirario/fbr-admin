import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import type { SystemSetting, SystemSettingKey } from "@/types/message-template";
import ClaudioClient from "./claudio-client";

export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const role = await getCurrentRole();
  if (role !== "admin") {
    redirect("/");
  }

  const supabase = await createClient();

  const [settingsRes, tplCountRes, convsCountRes] = await Promise.all([
    supabase.from("system_settings").select("key, value, updated_at, updated_by"),
    supabase
      .from("message_templates")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("whatsapp_conversations")
      .select("id, notes", { count: "exact" })
      .not("notes", "is", null),
  ]);

  const settings = (settingsRes.data ?? []) as SystemSetting[];
  const settingsMap = Object.fromEntries(
    settings.map((s) => [s.key as SystemSettingKey, s.value]),
  ) as Partial<Record<SystemSettingKey, string>>;

  const templatesCount = tplCountRes.count ?? 0;
  const conversationsWithNotes = (convsCountRes.data ?? []).filter(
    (c) => ((c as { notes: string | null }).notes ?? "").trim() !== "",
  ).length;

  return (
    <ClaudioClient
      initialPersona={settingsMap.claude_persona ?? ""}
      initialFacts={settingsMap.claude_facts ?? ""}
      templatesCount={templatesCount}
      conversationsWithNotes={conversationsWithNotes}
    />
  );
}
