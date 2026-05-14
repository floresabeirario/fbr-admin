"use client";

// ============================================================
// StickyNoteButton — post-it amarelo flutuante reutilizável
// ============================================================
// Usado no header dos workbenches (Preservação e Vale-Presente)
// para uma nota livre flutuante. Visualmente é um post-it ligeiramente
// rodado: amarelo claro com "+ Nota" quando vazio, amarelo intenso
// com preview de 2 linhas quando tem conteúdo. Click → popover com
// textarea, Guardar/Limpar.
// ============================================================

import { useState } from "react";
import { StickyNote } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface StickyNoteButtonProps {
  value: string;
  onSave: (v: string) => void;
  /** Título no tooltip (default: "Nota") */
  title?: string;
  /** Label do popover */
  label?: string;
  /** Placeholder do textarea */
  placeholder?: string;
}

export function StickyNoteButton({
  value,
  onSave,
  title = "Nota",
  label = "Nota",
  placeholder = "Ex: detalhe importante sobre este cliente…",
}: StickyNoteButtonProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const hasContent = value.trim().length > 0;
  const preview = hasContent ? value.replace(/\s+/g, " ").trim() : "";

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(value);
        else if (draft !== value) onSave(draft);
      }}
    >
      <PopoverTrigger
        title={hasContent ? title : `Adicionar ${title.toLowerCase()}`}
        className={`shrink-0 inline-flex items-start gap-1 h-9 max-w-[140px] rounded-md border px-1.5 py-1 text-[10px] leading-tight transition-shadow shadow-[2px_2px_0_rgba(0,0,0,0.08)] hover:shadow-[3px_3px_0_rgba(0,0,0,0.12)] -rotate-1 ${
          hasContent
            ? "bg-yellow-200 border-yellow-400 text-yellow-950"
            : "bg-yellow-50 border-yellow-200 text-yellow-600 hover:bg-yellow-100"
        }`}
      >
        <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
        {hasContent ? (
          <span className="text-left line-clamp-2 break-words">{preview}</span>
        ) : (
          <span className="font-medium">Nota</span>
        )}
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-3 bg-yellow-50 border-yellow-300"
        align="end"
        side="bottom"
      >
        <Label className="text-[10px] uppercase tracking-[0.15em] font-semibold text-yellow-900 mb-1.5 block">
          {label}
        </Label>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          rows={6}
          className="border-yellow-200 bg-surface text-sm text-yellow-950 placeholder:text-yellow-700/40"
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setDraft("")}
            className="h-7 px-2 rounded-md text-xs text-yellow-800 hover:bg-yellow-100"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              setOpen(false);
            }}
            className="h-7 px-3 rounded-md bg-yellow-600 text-white text-xs font-medium hover:bg-yellow-700"
          >
            Guardar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
