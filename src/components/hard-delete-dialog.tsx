"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const CONFIRM_WORD = "APAGAR";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemLabel: string;
  onConfirm: (justification: string) => Promise<void>;
}

export default function HardDeleteDialog({ open, onOpenChange, itemLabel, onConfirm }: Props) {
  const [confirmText, setConfirmText] = useState("");
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setConfirmText("");
      setJustification("");
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const canConfirm =
    confirmText.trim().toUpperCase() === CONFIRM_WORD &&
    justification.trim().length >= 3 &&
    !busy;

  async function handleConfirm() {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(justification.trim());
      onOpenChange(false);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Erro ao apagar.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-4 w-4" />
            Apagar definitivamente?
          </DialogTitle>
          <DialogDescription className="text-cocoa-700">
            Vais apagar <strong className="text-cocoa-900">{itemLabel}</strong> para sempre.
            Esta acção não pode ser desfeita. Os dados ficam no audit log mas o registo é removido da BD.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs font-medium text-cocoa-700">
              Escreve <span className="font-mono font-bold text-red-700">{CONFIRM_WORD}</span> para confirmar
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoFocus
              className="mt-1.5 font-mono tracking-wider uppercase"
            />
          </div>

          <div>
            <Label className="text-xs font-medium text-cocoa-700">
              Justificação <span className="text-red-700">*</span>
            </Label>
            <Textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Ex: encomenda de teste do formulário público"
              className="mt-1.5 min-h-[60px]"
              maxLength={500}
            />
            <p className="text-[10px] text-cocoa-500 mt-1">
              Fica registada no audit log. Mínimo 3 caracteres.
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="h-9 px-4 rounded-lg border border-cream-200 bg-surface text-sm text-cocoa-900 hover:bg-cream-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="h-9 px-4 rounded-lg bg-red-600 text-sm text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Apagar definitivamente
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
