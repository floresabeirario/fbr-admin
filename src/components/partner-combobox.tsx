"use client";

// ============================================================
// PartnerCombobox — selecciona um parceiro existente (cmdk)
// ============================================================
// Usado em workbenches (Preservação e Vale-Presente) para associar
// um parceiro recomendador. Pesquisa por nome + categoria. "Nenhum
// parceiro" limpa a associação.
// ============================================================

import { useState } from "react";
import { Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type PartnerOption = {
  id: string;
  name: string;
  category: string;
  status: string;
};

const PARTNER_CATEGORY_LABELS: Record<string, string> = {
  wedding_planners: "Wedding planner",
  floristas: "Florista",
  quintas_eventos: "Quinta de eventos",
  outros: "Outro",
};

export interface PartnerComboboxProps {
  partners: PartnerOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Classe do trigger (default: estilo cinzento neutro) */
  triggerCls?: string;
}

export function PartnerCombobox({
  partners,
  value,
  onChange,
  triggerCls = "h-9 rounded-md border border-cream-200 bg-surface text-sm",
}: PartnerComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? partners.find((p) => p.id === value) ?? null : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-expanded={open}
        className={`${triggerCls} flex-1 inline-flex items-center justify-between gap-2 px-3 text-left`}
      >
        {selected ? (
          <span className="flex items-center gap-1.5 truncate">
            <span className="text-sm">{selected.name}</span>
            <span className="text-[10px] text-cocoa-500 shrink-0">
              · {PARTNER_CATEGORY_LABELS[selected.category] ?? selected.category}
            </span>
          </span>
        ) : (
          <span className="text-cocoa-500">Sem parceiro</span>
        )}
        <Search className="h-3.5 w-3.5 text-cocoa-500 shrink-0" />
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Procurar parceiro…" />
          <CommandList>
            <CommandEmpty>Nenhum parceiro encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="nenhum"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <span className="text-cocoa-700 italic">Nenhum parceiro</span>
              </CommandItem>
              {partners.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${PARTNER_CATEGORY_LABELS[p.category] ?? ""}`}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm">{p.name}</span>
                    <span className="text-[10px] text-cocoa-500">
                      · {PARTNER_CATEGORY_LABELS[p.category] ?? p.category}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
