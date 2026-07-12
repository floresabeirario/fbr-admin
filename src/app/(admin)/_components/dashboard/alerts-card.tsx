"use client";

import Link from "next/link";
import { AlertTriangle, Bell, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardAlert } from "@/lib/dashboard";
import { SectionCard } from "./section-card";

const ALERT_STYLES: Record<DashboardAlert["severity"], string> = {
  info:   "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
  warn:   "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  danger: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
};

export function AlertsCard({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <SectionCard title={`Alertas (${alerts.length})`} icon={Bell} iconColor="text-amber-600">
      <div className="px-5 py-3 max-h-[420px] overflow-y-auto">
        {alerts.length === 0 && (
          <p className="text-sm text-cocoa-700 py-6 text-center">
            Sem alertas. Tudo em dia ✨
          </p>
        )}
        <div className="space-y-2">
          {alerts.map((a) => {
            const Inner = (
              <div className={cn("flex items-start gap-3 p-2.5 rounded-lg border", ALERT_STYLES[a.severity])}>
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="text-sm font-semibold leading-snug">{a.label}</div>
                  <div className="text-xs opacity-80 leading-snug">{a.detail}</div>
                </div>
                {/* Valor € num slot próprio, alinhado à direita (regra da casa) */}
                {a.amount && (
                  <div className="shrink-0 text-right text-sm font-semibold tabular-nums mt-0.5">
                    {a.amount}
                  </div>
                )}
                {a.href && <ChevronRight className="h-4 w-4 mt-0.5 opacity-60 shrink-0" />}
              </div>
            );
            return a.href ? (
              <Link key={a.id} href={a.href} className="block">
                {Inner}
              </Link>
            ) : (
              <div key={a.id}>{Inner}</div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
