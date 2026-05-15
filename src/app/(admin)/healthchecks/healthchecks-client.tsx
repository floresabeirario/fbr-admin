"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import {
  HeartPulse,
  Check,
  AlertTriangle,
  XCircle,
  Info,
  Database,
  Cog,
  PieChart,
  Plug,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { HealthCheck } from "./page";
import SistemaTopbar from "@/components/sistema-topbar";

const CATEGORY_META: Record<HealthCheck["category"], { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  database:     { label: "Base de dados",  icon: Database, color: "text-sky-500" },
  config:       { label: "Configuração",   icon: Cog,      color: "text-violet-500" },
  data:         { label: "Integridade dos dados", icon: PieChart, color: "text-amber-500" },
  integrations: { label: "Integrações",    icon: Plug,     color: "text-emerald-500" },
};

const STATUS_META: Record<HealthCheck["status"], { label: string; icon: React.ComponentType<{ className?: string }>; bg: string; text: string; border: string }> = {
  ok:      { label: "OK",       icon: Check,         bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-900" },
  warning: { label: "Atenção",  icon: AlertTriangle, bg: "bg-amber-50 dark:bg-amber-950/40",     text: "text-amber-700 dark:text-amber-300",     border: "border-amber-200 dark:border-amber-900" },
  error:   { label: "Erro",     icon: XCircle,       bg: "bg-rose-50 dark:bg-rose-950/40",       text: "text-rose-700 dark:text-rose-300",       border: "border-rose-200 dark:border-rose-900" },
  info:    { label: "Info",     icon: Info,          bg: "bg-sky-50 dark:bg-sky-950/40",         text: "text-sky-700 dark:text-sky-300",         border: "border-sky-200 dark:border-sky-900" },
};

export default function HealthchecksClient({
  checks,
  generatedAt,
}: {
  checks: HealthCheck[];
  generatedAt: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<HealthCheck["status"] | "todos">("todos");

  const counts = useMemo(() => {
    const c = { ok: 0, warning: 0, error: 0, info: 0 };
    for (const ch of checks) c[ch.status]++;
    return c;
  }, [checks]);

  const filtered = useMemo(() => {
    if (filter === "todos") return checks;
    return checks.filter((c) => c.status === filter);
  }, [checks, filter]);

  const grouped = useMemo(() => {
    const map = new Map<HealthCheck["category"], HealthCheck[]>();
    for (const c of filtered) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return map;
  }, [filtered]);

  const overall: HealthCheck["status"] = counts.error > 0 ? "error" : counts.warning > 0 ? "warning" : "ok";

  return (
    <>
    <SistemaTopbar />
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 shadow-sm flex items-center justify-center">
            <HeartPulse className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-cocoa-900">Healthchecks</h1>
            <p className="text-sm text-cocoa-700">
              Verificações operacionais — base de dados, configuração, integridade e integrações.
            </p>
          </div>
        </div>
        <Button
          onClick={() => router.refresh()}
          variant="outline"
          className="gap-1.5"
        >
          <RefreshCw className="h-4 w-4" />
          Recarregar
        </Button>
      </div>

      {/* Resumo */}
      <div className={cn(
        "rounded-xl border p-4 sm:p-5 space-y-3",
        STATUS_META[overall].bg,
        STATUS_META[overall].border,
      )}>
        <div className="flex items-center gap-3">
          {(() => {
            const Icon = STATUS_META[overall].icon;
            return <Icon className={cn("h-6 w-6", STATUS_META[overall].text)} />;
          })()}
          <h2 className={cn("text-lg font-semibold", STATUS_META[overall].text)}>
            {overall === "ok" && "Tudo OK"}
            {overall === "warning" && `${counts.warning} aviso${counts.warning === 1 ? "" : "s"}`}
            {overall === "error" && `${counts.error} erro${counts.error === 1 ? "" : "s"} crítico${counts.error === 1 ? "" : "s"}`}
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(["ok", "warning", "error", "info"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? "todos" : s)}
              className={cn(
                "rounded-lg border bg-surface px-3 py-2 text-left transition-all hover:shadow-sm",
                filter === s ? "ring-2 ring-offset-1" : "",
                STATUS_META[s].border,
                filter === s && STATUS_META[s].text.replace("text", "ring"),
              )}
            >
              <p className="text-[10px] uppercase tracking-wider text-cocoa-700 font-medium">
                {STATUS_META[s].label}
              </p>
              <p className={cn("text-2xl font-semibold", STATUS_META[s].text)}>
                {counts[s]}
              </p>
            </button>
          ))}
        </div>
        <p className="text-xs text-cocoa-700">
          Verificado em {format(parseISO(generatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}.
        </p>
      </div>

      {/* Filtro indicator */}
      {filter !== "todos" && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-cocoa-700">A mostrar apenas:</span>
          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", STATUS_META[filter].border, STATUS_META[filter].text, STATUS_META[filter].bg)}>
            {STATUS_META[filter].label}
          </span>
          <button onClick={() => setFilter("todos")} className="text-xs text-cocoa-700 hover:text-cocoa-900 underline">
            limpar filtro
          </button>
        </div>
      )}

      {/* Grupos */}
      {Array.from(grouped.entries()).map(([category, items]) => {
        const meta = CATEGORY_META[category];
        const Icon = meta.icon;
        return (
          <section key={category} className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon className={cn("h-4 w-4", meta.color)} />
              <h3 className="text-sm font-semibold text-cocoa-900 uppercase tracking-wider">
                {meta.label}
              </h3>
              <span className="text-xs text-cocoa-500">({items.length})</span>
            </div>
            <div className="rounded-xl border border-cream-200 bg-surface overflow-hidden divide-y divide-cream-100">
              {items.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
    </>
  );
}

function CheckRow({ check }: { check: HealthCheck }) {
  const meta = STATUS_META[check.status];
  const Icon = meta.icon;
  return (
    <div className={cn("flex items-start gap-3 p-3 sm:p-4", meta.bg + "/30")}>
      <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", meta.text)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-cocoa-900">{check.label}</p>
          <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border", meta.bg, meta.text, meta.border)}>
            {meta.label}
          </span>
          {check.count !== undefined && (
            <span className="text-[10px] text-cocoa-500">{check.count} registos</span>
          )}
        </div>
        <p className="text-xs text-cocoa-700 mt-0.5">{check.details}</p>
        {check.hint && (
          <p className="text-xs text-cocoa-900 mt-1 italic">💡 {check.hint}</p>
        )}
      </div>
    </div>
  );
}
