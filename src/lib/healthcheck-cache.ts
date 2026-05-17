import type { HealthCheck } from "./healthchecks";

export const HEALTHCHECK_STATUS_KEY = "healthcheck_status";

export type HealthcheckSummary = {
  ran_at: string;
  total: number;
  ok: number;
  warnings: number;
  errors: number;
  info: number;
  problems: Array<Pick<HealthCheck, "id" | "label" | "status" | "details">>;
};

export function summariseHealthchecks(checks: HealthCheck[]): HealthcheckSummary {
  const counts = { ok: 0, warning: 0, error: 0, info: 0 };
  for (const c of checks) counts[c.status]++;
  const problems = checks
    .filter((c) => c.status === "error" || c.status === "warning")
    .map(({ id, label, status, details }) => ({ id, label, status, details }));
  return {
    ran_at: new Date().toISOString(),
    total: checks.length,
    ok: counts.ok,
    warnings: counts.warning,
    errors: counts.error,
    info: counts.info,
    problems,
  };
}

export function overallStatus(summary: HealthcheckSummary): "ok" | "warning" | "error" {
  if (summary.errors > 0) return "error";
  if (summary.warnings > 0) return "warning";
  return "ok";
}
