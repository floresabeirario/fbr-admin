"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

// Paleta de acentos por secção — discreta, só na borda esquerda + cor do ícone
export type Accent =
  | "rose" | "amber" | "emerald" | "orange" | "indigo"
  | "pink" | "slate" | "green" | "sky" | "purple"
  | "yellow" | "violet" | "blue";

export const ACCENTS: Record<Accent, { border: string; icon: string; bgSoft: string }> = {
  rose:    { border: "border-l-rose-300 dark:border-l-rose-700",       icon: "text-rose-500 dark:text-rose-400",       bgSoft: "bg-rose-50/50 dark:bg-rose-950/30" },
  amber:   { border: "border-l-amber-300 dark:border-l-amber-700",     icon: "text-amber-500 dark:text-amber-400",     bgSoft: "bg-amber-50/50 dark:bg-amber-950/30" },
  emerald: { border: "border-l-emerald-300 dark:border-l-emerald-700", icon: "text-emerald-500 dark:text-emerald-400", bgSoft: "bg-emerald-50/50 dark:bg-emerald-950/30" },
  orange:  { border: "border-l-orange-300 dark:border-l-orange-700",   icon: "text-orange-500 dark:text-orange-400",   bgSoft: "bg-orange-50/50 dark:bg-orange-950/30" },
  indigo:  { border: "border-l-indigo-300 dark:border-l-indigo-700",   icon: "text-indigo-500 dark:text-indigo-400",   bgSoft: "bg-indigo-50/50 dark:bg-indigo-950/30" },
  pink:    { border: "border-l-pink-300 dark:border-l-pink-700",       icon: "text-pink-500 dark:text-pink-400",       bgSoft: "bg-pink-50/50 dark:bg-pink-950/30" },
  slate:   { border: "border-l-slate-300 dark:border-l-slate-600",     icon: "text-slate-500 dark:text-slate-400",     bgSoft: "bg-slate-50/50 dark:bg-slate-900/40" },
  green:   { border: "border-l-green-300 dark:border-l-green-700",     icon: "text-green-600 dark:text-green-400",     bgSoft: "bg-green-50/50 dark:bg-green-950/30" },
  sky:     { border: "border-l-sky-300 dark:border-l-sky-700",         icon: "text-sky-500 dark:text-sky-400",         bgSoft: "bg-sky-50/50 dark:bg-sky-950/30" },
  purple:  { border: "border-l-purple-300 dark:border-l-purple-700",   icon: "text-purple-500 dark:text-purple-400",   bgSoft: "bg-purple-50/50 dark:bg-purple-950/30" },
  yellow:  { border: "border-l-yellow-400 dark:border-l-yellow-700",   icon: "text-yellow-600 dark:text-yellow-400",   bgSoft: "bg-yellow-50/50 dark:bg-yellow-950/30" },
  violet:  { border: "border-l-violet-300 dark:border-l-violet-700",   icon: "text-violet-500 dark:text-violet-400",   bgSoft: "bg-violet-50/50 dark:bg-violet-950/30" },
  blue:    { border: "border-l-blue-300 dark:border-l-blue-700",       icon: "text-blue-500 dark:text-blue-400",       bgSoft: "bg-blue-50/50 dark:bg-blue-950/30" },
};

export const inp = "h-9 text-sm border-cream-200 bg-cream-50 focus:bg-surface text-cocoa-900 rounded-lg";
export const sel = "h-9 text-sm border-cream-200 bg-cream-50 text-cocoa-900 rounded-lg";

// Variantes "discretas" para o hero: parecem texto estático, revelam-se editáveis ao hover/focus.
// Placeholders em itálico + cinza muito claro para nunca se confundirem com dados reais.
export const subtlePlaceholder = "placeholder:italic placeholder:text-[#D4C8B8] placeholder:font-normal";
export const inpSubtle = `h-8 text-sm border border-transparent bg-transparent text-cocoa-900 rounded-lg hover:bg-cream-100 focus:bg-surface focus:border-cocoa-500 transition-colors ${subtlePlaceholder}`;
export const selSubtle = "h-8 text-sm border border-transparent bg-transparent text-cocoa-900 rounded-lg hover:bg-cream-100 data-[state=open]:bg-surface data-[state=open]:border-cocoa-500 transition-colors";
export const titleSubtle = `h-auto py-1.5 px-2 text-3xl font-semibold leading-tight tracking-tight border border-transparent bg-transparent text-cocoa-900 rounded-lg hover:bg-cream-100 focus:bg-surface focus:border-cocoa-500 transition-colors ${subtlePlaceholder}`;

export function Card({
  title,
  icon,
  accent,
  action,
  children,
  badge,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  accent?: Accent;
  action?: React.ReactNode;
  children: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}) {
  const a = accent ? ACCENTS[accent] : null;
  return (
    <div className={`rounded-2xl border border-cream-200 bg-surface overflow-hidden shadow-[0_1px_2px_rgba(61,43,31,0.04)] ${a ? `border-l-4 ${a.border}` : ""} ${className ?? ""}`}>
      <div className={`flex items-center justify-between gap-2 px-3 py-2 lg:px-5 lg:py-3 border-b border-cream-100 ${a ? a.bgSoft : ""}`}>
        <div className="flex items-center gap-2">
          {icon && <span className={a?.icon ?? "text-cocoa-500"}>{icon}</span>}
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cocoa-700">{title}</p>
          {badge}
        </div>
        {action}
      </div>
      <div className="p-3 lg:p-5 space-y-3 lg:space-y-4">{children}</div>
    </div>
  );
}

export function Grid2({ children }: { children: React.ReactNode }) {
  // Mobile: 1 coluna (inputs full-width); desktop sm:+: 2 colunas (igual ao original).
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

export function Field({ label, children, span2, hint }: { label: string; children: React.ReactNode; span2?: boolean; hint?: string }) {
  return (
    <div className={`space-y-1.5 ${span2 ? "col-span-2" : ""}`}>
      <Label className="text-xs font-medium text-cocoa-700">{label}</Label>
      {children}
      {hint && <p className="text-[10px] text-cocoa-500">{hint}</p>}
    </div>
  );
}

// Versão de Field para o hero — labels micro (uppercase + tracking) para harmonizar com inputs sem borda.
export function HeroField({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={`space-y-0.5 ${span2 ? "col-span-2" : ""}`}>
      <Label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-cocoa-500">{label}</Label>
      {children}
    </div>
  );
}

export function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className="border-cocoa-500 data-[state=checked]:bg-btn-primary data-[state=checked]:border-btn-primary"
      />
      <span className="text-sm text-cocoa-900">{label}</span>
    </label>
  );
}

export function PlaceholderBox({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-cream-200 bg-cream-50 px-4 py-5 text-center">
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-[#C4A882] border border-cream-200">
        {icon}
      </div>
      <p className="text-sm font-medium text-cocoa-900">{title}</p>
      <p className="mt-0.5 text-xs text-cocoa-700 leading-relaxed max-w-md mx-auto">{description}</p>
    </div>
  );
}
