import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import HealthchecksClient from "./healthchecks-client";

export const dynamic = "force-dynamic";

// Helpers async para isolar cálculos com `new Date()` do render do componente
// (a regra `react-hooks/purity` não distingue Server Components de Client).
async function fourDaysAgoIso(): Promise<string> {
  return new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
}
async function todayIso(): Promise<string> {
  return new Date().toISOString();
}

export interface HealthCheck {
  id: string;
  label: string;
  category: "database" | "config" | "data" | "integrations";
  status: "ok" | "warning" | "error" | "info";
  details: string;
  count?: number;
  hint?: string;
}

export default async function HealthchecksPage() {
  const role = await getCurrentRole();
  if (role !== "admin") redirect("/");

  const supabase = await createClient();
  const checks: HealthCheck[] = [];

  // ── Configuração: env vars críticas ──
  const envChecks: Array<{ name: string; required: boolean }> = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", required: true },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true },
    { name: "GOOGLE_CLIENT_ID", required: false },
    { name: "GOOGLE_CLIENT_SECRET", required: false },
    { name: "GOOGLE_REDIRECT_URI", required: false },
    { name: "ANTHROPIC_API_KEY", required: false },
    { name: "RESEND_API_KEY", required: false },
  ];
  for (const { name, required } of envChecks) {
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

  // ── Base de dados: existência das tabelas críticas ──
  const tableChecks = [
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
  for (const table of tableChecks) {
    const { error, count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    checks.push({
      id: `table-${table}`,
      label: `Tabela ${table}`,
      category: "database",
      status: error ? "error" : "ok",
      details: error
        ? `Erro: ${error.message}`
        : `Acessível${count !== null ? ` — ${count} registos` : ""}`,
      count: count ?? undefined,
      hint: error?.code === "42P01" ? "Tabela inexistente — corre a migração correspondente" : undefined,
    });
  }

  // ── Dados: integridade ──
  const { data: orphanedStatus } = await supabase
    .from("orders")
    .select("id")
    .is("deleted_at", null)
    .not("status", "in", "(entrega_flores_agendar,entrega_agendada,flores_enviadas,flores_recebidas,flores_na_prensa,reconstrucao_botanica,a_compor_design,a_aguardar_aprovacao,a_finalizar_quadro,a_ser_emoldurado,emoldurado,a_ser_fotografado,quadro_pronto,quadro_enviado,quadro_recebido,cancelado)");
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
    .lt("expiry_date", (await todayIso()).slice(0, 10))
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
    .lt("created_at", await fourDaysAgoIso());
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

  // ── Integrações: Google ──
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
        ? "Pasta-mãe \"FBR — Encomendas\" cacheada"
        : "Pasta-mãe ainda não foi criada/verificada",
    });
    checks.push({
      id: "integration-calendar",
      label: "Calendar — \"Preservação de Flores\"",
      category: "integrations",
      status: googleIntegration.calendar_id ? "ok" : "info",
      details: googleIntegration.calendar_id
        ? "Calendário cacheado"
        : "Sem calendário ainda — cria-se ao 1º evento",
    });
  }

  return <HealthchecksClient checks={checks} generatedAt={await todayIso()} />;
}
