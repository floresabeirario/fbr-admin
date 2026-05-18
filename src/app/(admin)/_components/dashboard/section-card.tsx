"use client";

import { cn } from "@/lib/utils";

// Wrapper genérico para cada um dos 4 cards do Dashboard.
// Header com ícone colorido + título + slot de acção; corpo flexível.
export function SectionCard({
  title,
  icon: Icon,
  iconColor,
  children,
  action,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-cream-200 bg-surface overflow-hidden flex flex-col">
      <header className="flex items-center gap-2 px-5 py-3 border-b border-cream-200">
        <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
        <h2 className="text-sm font-semibold text-cocoa-900 flex-1">{title}</h2>
        {action}
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  );
}
