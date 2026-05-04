import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import type { PartialPublicMessages } from "@/lib/public-status";
import DefaultMessagesClient from "./default-messages-client";

export default async function DefaultMessagesPage() {
  const supabase = await createClient();
  const role = await getCurrentRole();

  const { data } = await supabase
    .from("public_status_settings")
    .select("messages")
    .eq("id", 1)
    .single();

  const initial: PartialPublicMessages = (data?.messages as PartialPublicMessages) ?? {};

  return <DefaultMessagesClient initial={initial} canEdit={role === "admin"} />;
}
