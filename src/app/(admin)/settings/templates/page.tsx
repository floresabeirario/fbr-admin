import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import type {
  MessageTemplate,
  SystemSetting,
  SystemSettingKey,
  SystemSettingsMap,
} from "@/types/message-template";
import { SYSTEM_SETTING_KEYS } from "@/types/message-template";
import TemplatesClient from "./templates-client";

const SETTING_DEFAULTS: SystemSettingsMap = {
  payment_account_holder: "",
  payment_iban: "",
  payment_bic: "",
  payment_bank_name: "",
  payment_mbway: "",
  studio_address_url: "",
  studio_address_text: "",
};

export default async function TemplatesPage() {
  const role = await getCurrentRole();
  if (role !== "admin") {
    redirect("/");
  }

  const supabase = await createClient();

  const [templatesRes, settingsRes] = await Promise.all([
    supabase
      .from("message_templates")
      .select("*")
      .order("category", { ascending: true })
      .order("position", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("system_settings").select("key, value, updated_at, updated_by"),
  ]);

  const templates = (templatesRes.data ?? []) as MessageTemplate[];
  const settingsRows = (settingsRes.data ?? []) as SystemSetting[];

  // Constroi um mapa completo (com defaults para chaves em falta)
  const settings: SystemSettingsMap = { ...SETTING_DEFAULTS };
  for (const row of settingsRows) {
    if (SYSTEM_SETTING_KEYS.includes(row.key as SystemSettingKey)) {
      settings[row.key as SystemSettingKey] = row.value;
    }
  }

  return <TemplatesClient initialTemplates={templates} initialSettings={settings} />;
}
