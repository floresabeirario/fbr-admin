import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import type { AuditLogEntry } from "@/types/audit";
import AuditClient from "./audit-client";

export const dynamic = "force-dynamic";

interface SearchParams {
  table?: string;
  action?: string;
  since?: string;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const role = await getCurrentRole();
  if (role !== "admin") redirect("/");

  const params = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("audit_log_with_email", {
    p_table: params.table || null,
    p_action: params.action || null,
    p_since: params.since || null,
    p_limit: 200,
  });

  const entries: AuditLogEntry[] = error ? [] : ((data ?? []) as AuditLogEntry[]);

  return (
    <AuditClient
      entries={entries}
      initialTable={params.table ?? ""}
      initialAction={params.action ?? ""}
      initialSince={params.since ?? ""}
      error={error?.message ?? null}
    />
  );
}
