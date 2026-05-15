"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Shield, History, HeartPulse, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/google", label: "Definições", icon: Settings, adminOnly: true },
  { href: "/settings/rgpd", label: "RGPD", icon: Shield, adminOnly: true },
  { href: "/settings/audit", label: "Histórico", icon: History, adminOnly: true },
  { href: "/healthchecks", label: "Healthchecks", icon: HeartPulse, adminOnly: true },
  { href: "/ecossistema", label: "Ecossistema", icon: Globe, adminOnly: false },
] as const;

export default function SistemaTopbar({ isAdmin = true }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  const visible = TABS.filter((t) => isAdmin || !t.adminOnly);

  return (
    <div className="border-b border-cream-200 bg-surface">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <h1 className="text-base font-semibold text-cocoa-900 shrink-0">Sistema</h1>
          <nav className="flex items-center gap-1 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
            {visible.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                    active
                      ? "bg-cocoa-900 text-surface dark:bg-[#E8D5B5] dark:text-[#1B1611]"
                      : "text-cocoa-700 hover:bg-cream-100 hover:text-cocoa-900 border border-cream-200",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
