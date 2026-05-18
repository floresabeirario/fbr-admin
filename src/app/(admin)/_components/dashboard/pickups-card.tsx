"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PICKUP_KIND_LABELS, PICKUP_KIND_COLORS, type PickupItem } from "@/lib/dashboard";
import { SectionCard } from "./section-card";
import { formatRelativeDays } from "./format-helpers";

export function PickupsCard({ pickups }: { pickups: PickupItem[] }) {
  return (
    <SectionCard
      title="Recolhas e entregas (próximos 30 dias)"
      icon={Truck}
      iconColor="text-sky-600"
      action={
        <Link
          href="/entregas-recolhas"
          className="text-xs text-cocoa-700 hover:text-cocoa-900"
        >
          Ver tudo →
        </Link>
      }
    >
      <div className="px-5 py-3 max-h-[420px] overflow-y-auto">
        {pickups.length === 0 && (
          <p className="text-sm text-cocoa-700 py-6 text-center">
            Nada agendado nos próximos 30 dias.
          </p>
        )}
        <div className="space-y-2">
          {pickups.map((p) => (
            <Link
              key={`${p.order.id}-${p.kind}`}
              href={`/preservacao/${p.order.order_id ?? p.order.id}`}
              className="flex items-start gap-3 p-2.5 rounded-lg border border-cream-100 hover:border-cream-200 hover:bg-cream-50 transition-colors"
            >
              <div className="shrink-0 text-center">
                <div className="text-xs font-semibold text-[#C4A882] uppercase">
                  {format(parseISO(p.date), "MMM", { locale: pt })}
                </div>
                <div className="text-lg font-semibold text-cocoa-900 leading-none">
                  {format(parseISO(p.date), "dd")}
                </div>
                <div className="text-[10px] text-cocoa-700 uppercase">
                  {format(parseISO(p.date), "EEE", { locale: pt })}
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-sm font-medium text-cocoa-900 truncate">
                  {p.order.client_name}
                </div>
                <div className="text-xs text-cocoa-700 truncate">📍 {p.location}</div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("h-5 px-1.5 py-0 text-[10px] font-normal", PICKUP_KIND_COLORS[p.kind])}
                  >
                    {PICKUP_KIND_LABELS[p.kind]}
                  </Badge>
                  <span className="text-[11px] text-cocoa-700">
                    {formatRelativeDays(p.date)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
