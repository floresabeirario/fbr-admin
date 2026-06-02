"use client";

import { useState } from "react";
import { Handshake, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Partner } from "@/types/partner";
import type { PublicFigure } from "@/types/public-figure";
import ParceriasClient from "./parcerias-client";
import FigurasClient from "./figuras-client";

interface Props {
  initialPartners: Partner[];
  ordersCount: Record<string, number>;
  vouchersCount: Record<string, number>;
  initialFigures: PublicFigure[];
}

type Mode = "parcerias" | "figuras";

// Uma só entrada na sidebar ("Parcerias") com duas grandes partes:
// Parcerias (recomendadores) e Figuras Públicas (seeding a influencers/noivas).
export default function ParceriasTabs({
  initialPartners,
  ordersCount,
  vouchersCount,
  initialFigures,
}: Props) {
  const [mode, setMode] = useState<Mode>("figuras");

  return (
    <div className="flex flex-col h-full">
      {/* Toggle de topo */}
      <div className="flex items-center gap-1 px-3 sm:px-6 pt-3 shrink-0">
        <div className="flex items-center gap-1 rounded-lg border border-cream-200 bg-surface p-1">
          <ModeButton
            active={mode === "figuras"}
            onClick={() => setMode("figuras")}
            icon={Star}
            label="Figuras Públicas"
            count={initialFigures.length}
          />
          <ModeButton
            active={mode === "parcerias"}
            onClick={() => setMode("parcerias")}
            icon={Handshake}
            label="Parcerias"
            count={initialPartners.length}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {mode === "parcerias" ? (
          <ParceriasClient
            initialPartners={initialPartners}
            ordersCount={ordersCount}
            vouchersCount={vouchersCount}
          />
        ) : (
          <FigurasClient initialFigures={initialFigures} />
        )}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-btn-primary text-btn-primary-fg"
          : "text-cocoa-700 hover:bg-cream-50 hover:text-cocoa-900",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
          active ? "bg-white/20 text-white" : "bg-cream-100 text-cocoa-700",
        )}
      >
        {count}
      </span>
    </button>
  );
}
