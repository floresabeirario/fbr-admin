"use client";

// Diálogos do workbench: confirmação de edição de campo do cliente,
// lembretes de pagamento 40%/30%, data de entrega do quadro e arquivar.
// O ESTADO dos diálogos vive no workbench-client (é aberto pelos
// handlers de lá); aqui só está a apresentação. Extraídos do
// workbench-client.tsx (refactor sessão 128).
//
// O diálogo de mudança de pagamento saiu na sessão 178: mudar a fase
// passou a registar o pagamento sozinho, e o que ele lembrava vive
// noutros sítios (MissingInvoiceAlert, campo do NIF no cartão Finanças,
// botão da pasta Drive no hero).

import {
  Loader2,
  AlertTriangle,
  Camera,
  Wallet,
  Package,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Order } from "@/types/database";
import { inp } from "./layout";

/** Pedido de confirmação ao alterar um campo preenchido pelo cliente. */
export type ClientEditRequest = {
  label: string;
  oldDisplay: string;
  newDisplay: string;
  apply: () => void;
};

/* ── Diálogo de confirmação de edição de campo do cliente ─────── */
export function ClientEditDialog({
  dialog,
  onClose,
  onConfirm,
}: {
  dialog: ClientEditRequest | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!dialog} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cocoa-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Confirmar alteração
          </DialogTitle>
          <DialogDescription className="text-cocoa-700">
            Este campo foi preenchido pelo <strong className="text-cocoa-900">cliente</strong> no formulário.
            Tens a certeza que queres alterar?
          </DialogDescription>
        </DialogHeader>

        {dialog && (
          <div className="space-y-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-cocoa-700">
              {dialog.label}
            </p>
            <div className="rounded-lg border border-cream-200 bg-cream-50 divide-y divide-cream-200">
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="text-[10px] uppercase tracking-wider text-cocoa-500 w-12">Antes</span>
                <span className="text-sm text-cocoa-700 line-through">{dialog.oldDisplay}</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2 bg-amber-50/50">
                <span className="text-[10px] uppercase tracking-wider text-amber-700 w-12">Novo</span>
                <span className="text-sm font-medium text-cocoa-900">{dialog.newDisplay}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-cream-200 bg-surface text-sm text-cocoa-900 hover:bg-cream-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="h-9 px-4 rounded-lg bg-amber-600 text-sm text-white font-medium hover:bg-amber-700 transition-colors"
          >
            Sim, alterar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Diálogo lembrete de pagamento (40% ou 30%) ────────────────── */
export function PaymentReminderDialog({
  dialog,
  onClose,
  onConfirm,
}: {
  dialog: null | { kind: "40" | "30"; nextStatus: Order["status"] };
  onClose: () => void;
  onConfirm: (alreadyAsked: boolean) => void;
}) {
  return (
    <Dialog open={!!dialog} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cocoa-900">
            <Wallet className="h-4 w-4 text-amber-600" />
            {dialog?.kind === "40" ? "Pedir 40% ao cliente?" : "Pedir últimos 30% ao cliente?"}
          </DialogTitle>
          <DialogDescription className="text-cocoa-700">
            {dialog?.kind === "40"
              ? "As flores chegaram à FBR — é boa altura para pedir os 40% seguintes ao cliente. Já pediste?"
              : "O quadro está praticamente pronto — é boa altura para pedir os últimos 30%. Já pediste?"}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => onConfirm(false)}
            className="h-9 px-4 rounded-lg border border-cream-200 bg-surface text-sm text-cocoa-900 hover:bg-cream-50 transition-colors"
          >
            Ainda não — lembra-me depois
          </button>
          <button
            onClick={() => onConfirm(true)}
            className="h-9 px-4 rounded-lg bg-amber-600 text-sm text-white font-medium hover:bg-amber-700 transition-colors"
          >
            {dialog?.kind === "40" ? "Sim, já pedi os 40%" : "Sim, já pedi os 30%"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Diálogo "Quadro recebido" → pede data de entrega ──────────── */
export function DeliveryDateDialog({
  open,
  onOpenChange,
  draft,
  setDraft,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: string;
  setDraft: (v: string) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cocoa-900">
            <Package className="h-4 w-4 text-purple-600" />
            Quadro recebido
          </DialogTitle>
          <DialogDescription className="text-cocoa-700">
            Para fechar bem esta encomenda, indica em que dia o cliente recebeu o quadro.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Label className="text-xs font-medium text-cocoa-700">Data de entrega do quadro</Label>
          <Input
            className={inp + " mt-1.5"}
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <p className="text-[10px] text-cocoa-500 mt-2 leading-relaxed">
            Esta data é usada para calcular a validade do cupão de 5%.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-lg border border-cream-200 bg-surface text-sm text-cocoa-900 hover:bg-cream-50 transition-colors"
          >
            Mais tarde
          </button>
          <button
            onClick={onConfirm}
            className="h-9 px-4 rounded-lg bg-btn-primary text-sm text-btn-primary-fg font-medium hover:bg-btn-primary-hover transition-colors disabled:opacity-50"
            disabled={!draft}
          >
            Guardar data
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Diálogo "Quadro enviado" → pede registo CTT + data de envio ──
   Só abre quando o quadro segue por CTT e ainda não há tracking
   (mig 093). "Mais tarde" muda o estado na mesma — nunca bloqueia. */
export function FrameShippedDialog({
  open,
  onOpenChange,
  trackingDraft,
  setTrackingDraft,
  dateDraft,
  setDateDraft,
  onConfirm,
  onSkip,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trackingDraft: string;
  setTrackingDraft: (v: string) => void;
  dateDraft: string;
  setDateDraft: (v: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onSkip(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cocoa-900">
            <Package className="h-4 w-4 text-sky-600" />
            Quadro enviado por CTT
          </DialogTitle>
          <DialogDescription className="text-cocoa-700">
            Regista já o código de tracking e a data de envio — ficam no cartão
            de envios e alimentam a página Entregas e Recolhas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs font-medium text-cocoa-700">Registo CTT</Label>
            <Input
              className={inp + " mt-1.5 font-mono"}
              value={trackingDraft}
              onChange={(e) => setTrackingDraft(e.target.value)}
              placeholder="Ex: RR123456789PT"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-cocoa-700">Data de envio</Label>
            <Input
              className={inp + " mt-1.5"}
              type="date"
              value={dateDraft}
              onChange={(e) => setDateDraft(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => { onSkip(); onOpenChange(false); }}
            className="h-9 px-4 rounded-lg border border-cream-200 bg-surface text-sm text-cocoa-900 hover:bg-cream-50 transition-colors"
          >
            Mais tarde
          </button>
          <button
            onClick={onConfirm}
            className="h-9 px-4 rounded-lg bg-btn-primary text-sm text-btn-primary-fg font-medium hover:bg-btn-primary-hover transition-colors"
          >
            Guardar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Lembrete "Flores recebidas" → fotografar as flores ────────────
   Informativo, não bloqueia: o estado já foi (ou vai ser) aplicado. */
export function FlowersPhotoReminderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cocoa-900">
            <Camera className="h-4 w-4 text-emerald-600" />
            Fotografar as flores
          </DialogTitle>
          <DialogDescription className="text-cocoa-700">
            As flores chegaram e esta encomenda ainda não tem foto. Tira a foto
            do estado em que chegaram e anexa-a no topo do workbench — é a
            referência para a reconstrução e para qualquer conversa com o cliente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-lg bg-btn-primary text-sm text-btn-primary-fg font-medium hover:bg-btn-primary-hover transition-colors"
          >
            Entendido
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Diálogo: arquivar encomenda ───────────────────────────────── */
export function ArchiveDialog({
  open,
  onOpenChange,
  archiving,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  archiving: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cocoa-900">
            <Trash2 className="h-4 w-4 text-red-600" />
            Arquivar esta encomenda?
          </DialogTitle>
          <DialogDescription className="text-cocoa-700">
            A encomenda fica arquivada e deixa de aparecer na lista. Podes recuperá-la
            ou apagá-la definitivamente em <strong>Mostrar arquivados</strong> na listagem.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-lg border border-cream-200 bg-surface text-sm text-cocoa-900 hover:bg-cream-50 transition-colors"
            disabled={archiving}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="h-9 px-4 rounded-lg bg-red-600 text-sm text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
            disabled={archiving}
          >
            {archiving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Arquivar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
