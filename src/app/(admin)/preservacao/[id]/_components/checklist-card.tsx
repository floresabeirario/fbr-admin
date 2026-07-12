"use client";

// Card "Checklist da fase" — passos standard do grupo de estados actual
// (src/lib/phase-checklist.ts) + itens custom por encomenda. O estado
// vive em orders.phase_checklist (mig 093) e persiste entre fases: ao
// voltar atrás no estado, o que estava feito continua feito.

import { useState } from "react";
import { ListChecks, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { Order, PhaseChecklistState } from "@/types/database";
import { checklistItemsForStatus } from "@/lib/phase-checklist";
import { Card, CardSummary, inp } from "./layout";
import type { UpdateFn } from "./shared";

export function ChecklistCard({ local, update }: { local: Order; update: UpdateFn }) {
  const [newLabel, setNewLabel] = useState("");

  const standard = checklistItemsForStatus(local.status);
  const state: PhaseChecklistState = local.phase_checklist ?? {};
  const doneIds = new Set(state.done ?? []);
  const custom = state.custom ?? [];

  // Sem itens standard para esta fase (ex.: cancelado) e sem custom → nada a mostrar.
  if (standard.length === 0 && custom.length === 0 && local.status === "cancelado") return null;

  const doneCount =
    standard.filter((i) => doneIds.has(i.id)).length + custom.filter((c) => c.done).length;
  const total = standard.length + custom.length;
  const allDone = total > 0 && doneCount === total;

  function save(next: PhaseChecklistState) {
    update("phase_checklist", next);
  }

  function toggleStandard(id: string, checked: boolean) {
    const done = new Set(state.done ?? []);
    if (checked) done.add(id);
    else done.delete(id);
    save({ ...state, done: [...done] });
  }

  function toggleCustom(id: string, checked: boolean) {
    save({
      ...state,
      custom: custom.map((c) => (c.id === id ? { ...c, done: checked } : c)),
    });
  }

  function addCustom() {
    const label = newLabel.trim();
    if (!label) return;
    save({
      ...state,
      custom: [...custom, { id: `c-${Date.now()}`, label, done: false }],
    });
    setNewLabel("");
  }

  function removeCustom(id: string) {
    save({ ...state, custom: custom.filter((c) => c.id !== id) });
  }

  return (
    <Card
      title="Checklist da fase"
      icon={<ListChecks className="h-3.5 w-3.5" />}
      accent="sky"
      // Mobile: logo a seguir aos alertas (mesmo order-2 — desempata pela
      // ordem no DOM); desktop: coluna do meio, antes das Flores.
      className="order-2 lg:order-none"
      badge={
        total > 0 ? (
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
              allDone ? "text-green-700 bg-green-100" : "text-sky-700 bg-sky-100"
            }`}
          >
            {doneCount}/{total}
          </span>
        ) : undefined
      }
      autoCollapsed={allDone}
      summary={<CardSummary>{allDone ? "Tudo feito nesta fase ✓" : `${doneCount}/${total} feitos`}</CardSummary>}
    >
      <div className="space-y-1.5">
        {standard.map((item) => {
          const checked = doneIds.has(item.id);
          return (
            <label key={item.id} className="flex items-start gap-2 cursor-pointer select-none py-0.5">
              <Checkbox
                checked={checked}
                onCheckedChange={(v) => toggleStandard(item.id, !!v)}
                className="mt-0.5 border-cocoa-500 data-[state=checked]:bg-btn-primary data-[state=checked]:border-btn-primary"
              />
              <span className={`text-sm leading-snug ${checked ? "text-cocoa-500 line-through" : "text-cocoa-900"}`}>
                {item.label}
              </span>
            </label>
          );
        })}

        {custom.map((item) => (
          <div key={item.id} className="group flex items-start gap-2 py-0.5">
            <label className="flex items-start gap-2 cursor-pointer select-none flex-1 min-w-0">
              <Checkbox
                checked={item.done}
                onCheckedChange={(v) => toggleCustom(item.id, !!v)}
                className="mt-0.5 border-cocoa-500 data-[state=checked]:bg-btn-primary data-[state=checked]:border-btn-primary"
              />
              <span className={`text-sm leading-snug ${item.done ? "text-cocoa-500 line-through" : "text-cocoa-900"}`}>
                {item.label}
              </span>
            </label>
            <button
              type="button"
              onClick={() => removeCustom(item.id)}
              className="opacity-0 group-hover:opacity-100 text-cocoa-500 hover:text-rose-600 transition-opacity shrink-0 mt-0.5"
              title="Remover item"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        <div className="flex gap-1.5 pt-1.5">
          <Input
            className={inp + " flex-1 min-w-0"}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Acrescentar passo só desta encomenda…"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!newLabel.trim()}
            className="h-9 px-3 inline-flex items-center rounded-lg border border-sky-300 bg-sky-50 text-sky-800 text-xs font-medium hover:bg-sky-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Adicionar item à checklist"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </Card>
  );
}
