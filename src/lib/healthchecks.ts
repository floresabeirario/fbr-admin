import type { SupabaseClient } from "@supabase/supabase-js";

export interface HealthCheck {
  id: string;
  label: string;
  category: "database" | "config" | "data" | "integrations";
  status: "ok" | "warning" | "error" | "info";
  details: string;
  count?: number;
  hint?: string;
}

const VALID_ORDER_STATUSES =
  "(entrega_flores_agendar,entrega_agendada,flores_enviadas,flores_recebidas,flores_na_prensa,reconstrucao_botanica,a_compor_design,a_aguardar_aprovacao,a_finalizar_quadro,a_ser_emoldurado,emoldurado,a_ser_fotografado,quadro_pronto,quadro_enviado,quadro_recebido,cancelado)";

const ENV_CHECKS: Array<{ name: string; required: boolean }> = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: false },
  { name: "CRON_SECRET", required: false },
  { name: "GOOGLE_CLIENT_ID", required: false },
  { name: "GOOGLE_CLIENT_SECRET", required: false },
  { name: "GOOGLE_REDIRECT_URI", required: false },
  { name: "ANTHROPIC_API_KEY", required: false },
  { name: "RESEND_API_KEY", required: false },
  { name: "NEXT_PUBLIC_TURNSTILE_SITE_KEY", required: false },
];

const TABLES = [
  "orders",
  "vouchers",
  "partners",
  "tasks",
  "personal_checklist",
  "competitors",
  "pricing_items",
  "ideas",
  "recipes",
  "expenses",
  "chat_messages",
  "google_integration",
  "public_status_settings",
  "audit_log",
];

export async function runHealthchecks(
  supabase: SupabaseClient,
): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  const todayIso = new Date().toISOString();
  const fourDaysAgoIso = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

  for (const { name, required } of ENV_CHECKS) {
    const present = !!process.env[name];
    checks.push({
      id: `env-${name}`,
      label: name,
      category: "config",
      status: present ? "ok" : required ? "error" : "warning",
      details: present
        ? "Definida"
        : required
          ? "Obrigatória — sem isto a plataforma não funciona"
          : "Opcional — só necessária se a integração estiver activa",
    });
  }

  for (const table of TABLES) {
    let error: { message?: string; code?: string } | null = null;
    let count: number | null = null;
    try {
      const res = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      error = res.error;
      count = res.count;
    } catch (e) {
      error = { message: e instanceof Error ? e.message : String(e) };
    }
    const errMsg = error
      ? error.message && error.message.trim().length > 0
        ? error.message
        : `Erro sem mensagem (code=${error.code ?? "n/a"}) — provável problema de rede ou env vars`
      : "";
    checks.push({
      id: `table-${table}`,
      label: `Tabela ${table}`,
      category: "database",
      status: error ? "error" : "ok",
      details: error
        ? `Erro: ${errMsg}`
        : `Acessível${count !== null ? ` — ${count} registos` : ""}`,
      count: count ?? undefined,
      hint: error?.code === "42P01" ? "Tabela inexistente — corre a migração correspondente" : undefined,
    });
  }

  const { data: orphanedStatus } = await supabase
    .from("orders")
    .select("id")
    .is("deleted_at", null)
    .not("status", "in", VALID_ORDER_STATUSES);
  checks.push({
    id: "data-orphan-status",
    label: "Encomendas com estado desconhecido",
    category: "data",
    status: (orphanedStatus?.length ?? 0) === 0 ? "ok" : "error",
    details: (orphanedStatus?.length ?? 0) === 0
      ? "Todas as encomendas têm estado válido"
      : `${orphanedStatus?.length} encomenda(s) com estado fora do enum — aparecem em "Sem grupo"`,
    count: orphanedStatus?.length,
  });

  const { count: ordersWithoutClient } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .or("client_name.is.null,client_name.eq.");
  checks.push({
    id: "data-no-client",
    label: "Encomendas sem nome de cliente",
    category: "data",
    status: (ordersWithoutClient ?? 0) === 0 ? "ok" : "warning",
    details: (ordersWithoutClient ?? 0) === 0
      ? "Todas as encomendas têm cliente"
      : `${ordersWithoutClient} encomenda(s) sem nome — provavelmente importação antiga`,
    count: ordersWithoutClient ?? undefined,
  });

  const { count: vouchersExpired } = await supabase
    .from("vouchers")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .lt("expiry_date", todayIso.slice(0, 10))
    .eq("usage_status", "preservacao_nao_agendada");
  checks.push({
    id: "data-vouchers-expired",
    label: "Vales expirados não convertidos",
    category: "data",
    status: (vouchersExpired ?? 0) === 0 ? "ok" : "warning",
    details: (vouchersExpired ?? 0) === 0
      ? "Não há vales expirados pendentes"
      : `${vouchersExpired} vale(s) expirado(s) sem preservação agendada`,
    count: vouchersExpired ?? undefined,
    hint: (vouchersExpired ?? 0) > 0 ? "Considera renovar ou arquivar" : undefined,
  });

  const { count: oldStuckOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "entrega_flores_agendar")
    .eq("contacted", false)
    .lt("created_at", fourDaysAgoIso);
  checks.push({
    id: "data-stuck-prereservas",
    label: "Pré-reservas sem contacto há ≥4 dias",
    category: "data",
    status: (oldStuckOrders ?? 0) === 0 ? "ok" : "warning",
    details: (oldStuckOrders ?? 0) === 0
      ? "Todas as pré-reservas estão dentro do prazo"
      : `${oldStuckOrders} pré-reserva(s) parada(s)`,
    count: oldStuckOrders ?? undefined,
  });

  const { data: googleIntegration } = await supabase
    .from("google_integration")
    .select("google_email, connected_at, drive_root_folder_id, calendar_id")
    .limit(1)
    .maybeSingle();
  checks.push({
    id: "integration-google",
    label: "Google (Drive + Gmail + Calendar)",
    category: "integrations",
    status: googleIntegration ? "ok" : "warning",
    details: googleIntegration
      ? `Conectado como ${googleIntegration.google_email}`
      : "Não conectado — Drive e Calendar não funcionam até ligar em /settings/google",
    hint: !googleIntegration ? "Vai a Definições Google e clica 'Conectar'" : undefined,
  });

  if (googleIntegration) {
    checks.push({
      id: "integration-drive-folder",
      label: "Drive — pasta-mãe criada",
      category: "integrations",
      status: googleIntegration.drive_root_folder_id ? "ok" : "warning",
      details: googleIntegration.drive_root_folder_id
        ? 'Pasta-mãe "FBR — Encomendas" cacheada'
        : "Pasta-mãe ainda não foi criada/verificada",
    });
    checks.push({
      id: "integration-calendar",
      label: 'Calendar — "Preservação de Flores"',
      category: "integrations",
      status: googleIntegration.calendar_id ? "ok" : "info",
      details: googleIntegration.calendar_id
        ? "Calendário cacheado"
        : "Sem calendário ainda — cria-se ao 1º evento",
    });
  }

  // Backup diário da BD para a Drive (cron das 05:00 UTC). Um backup
  // que parte em silêncio é pior que não ter backup — daí este check.
  const { data: backupRow, error: backupReadError } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "backup_status")
    .maybeSingle();
  let backupStatus: HealthCheck["status"] = "warning";
  let backupDetails = "Ainda nenhum backup registado — o cron corre às 05:00 UTC";
  let backupHint: string | undefined =
    "Se já passou um dia do deploy, verifica o cron /api/cron/backup na Vercel";
  if (backupReadError) {
    backupDetails = `Não consegui ler o estado do backup: ${backupReadError.message}`;
    backupHint = undefined;
  } else if (backupRow?.value) {
    try {
      const parsed = JSON.parse(backupRow.value) as {
        ran_at?: string;
        ok?: boolean;
        file_name?: string;
        size_bytes?: number;
        total_rows?: number;
        error?: string;
      };
      const ranAtMs = parsed.ran_at ? Date.parse(parsed.ran_at) : NaN;
      const ageHours = Number.isNaN(ranAtMs)
        ? Infinity
        : (Date.now() - ranAtMs) / 3_600_000;
      if (parsed.ok === false) {
        backupStatus = "error";
        backupDetails = `Último backup FALHOU: ${parsed.error ?? "sem detalhe"}`;
        backupHint = "Vê os logs do /api/cron/backup na Vercel";
      } else if (ageHours > 48) {
        backupStatus = "error";
        backupDetails = `Último backup com sucesso há ${Math.floor(ageHours / 24)} dia(s) — o cron deixou de correr`;
        backupHint = "Verifica os crons do projecto na Vercel";
      } else {
        backupStatus = "ok";
        const sizeKb = parsed.size_bytes ? Math.round(parsed.size_bytes / 1024) : null;
        backupDetails = `${parsed.file_name ?? "backup"} na Drive${
          parsed.total_rows != null ? ` — ${parsed.total_rows} registos` : ""
        }${sizeKb != null ? `, ${sizeKb} KB` : ""}`;
        backupHint = undefined;
      }
    } catch {
      backupDetails = "Estado do backup ilegível (JSON inválido em system_settings)";
      backupHint = undefined;
    }
  }
  checks.push({
    id: "integration-backup",
    label: "Backup diário da BD → Drive",
    category: "integrations",
    status: backupStatus,
    details: backupDetails,
    hint: backupHint,
  });

  return checks;
}
