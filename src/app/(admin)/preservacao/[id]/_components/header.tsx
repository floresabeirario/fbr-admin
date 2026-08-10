"use client";

// Header fixo do workbench (navegação, nome/ID, alertas do evento, estado,
// lembretes, nota post-it, arquivar) + faixa de cliente repetido.
// Extraído do workbench-client.tsx (refactor sessão 128).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Loader2,
  Check,
  AlertTriangle,
  Clock,
  Pencil,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import WorkbenchNavigator from "@/components/workbench-navigator";
import { StickyNoteButton } from "@/components/sticky-note-button";
import type { Order } from "@/types/database";
import { STATUS_LABELS } from "@/types/database";
import { CheckRow, inp } from "./layout";
import { StatusSelect } from "./fields";
import type { UpdateFn, DuplicateOrderInfo } from "./shared";

export function WorkbenchHeader({
  local,
  canEdit,
  update,
  onStatusChange,
  daysUntilEvent,
  overdueEvent,
  soonEvent,
  showContactadaPrompt,
  show40Prompt,
  show30Prompt,
  saveState,
  onArchive,
}: {
  local: Order;
  canEdit: boolean;
  update: UpdateFn;
  onStatusChange: (s: Order["status"]) => void;
  daysUntilEvent: number | null;
  overdueEvent: boolean;
  soonEvent: boolean;
  showContactadaPrompt: boolean;
  show40Prompt: boolean;
  show30Prompt: boolean;
  saveState: "idle" | "saving" | "saved";
  onArchive: () => void;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  // Seta de voltar: se viemos de dentro da app (a lista de preservação),
  // usa o histórico do browser para RESTAURAR a vista/filtros/scroll onde
  // estávamos. Antes era um Link fixo para "/preservacao" que recarregava a
  // lista no estado inicial (parecia ir para a "página inicial"). Só cai no
  // href quando não há histórico (workbench aberto directamente por link).
  function handleBack(e: React.MouseEvent<HTMLAnchorElement>) {
    if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  }

  // Edição do ID curto da encomenda (popover no header)
  const [orderIdDraft, setOrderIdDraft] = useState("");
  const [orderIdPopoverOpen, setOrderIdPopoverOpen] = useState(false);

  function copyId() {
    navigator.clipboard.writeText(local.order_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function saveOrderId() {
    const v = orderIdDraft.trim().toUpperCase();
    if (!v || v === local.order_id) {
      setOrderIdPopoverOpen(false);
      return;
    }
    update("order_id", v);
    setOrderIdPopoverOpen(false);
  }

  return (
    <header className="shrink-0 sticky top-0 z-20 bg-surface border-b border-cream-200 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-2.5 py-1.5 sm:gap-x-3 sm:gap-y-2 sm:px-6 sm:py-3">
        <Link
          href="/preservacao"
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-cocoa-700 hover:text-cocoa-900 transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Voltar</span>
        </Link>

        {/* Setas anterior/próximo. Em mobile descem para o fim da linha de baixo
            (order-last) para não roubar largura ao nome — a prioridade no topo é
            o nome. Em sm+ ficam aqui, logo a seguir à seta de voltar. */}
        <div className="order-last sm:order-none shrink-0">
          <WorkbenchNavigator
            navKey="orders"
            currentId={local.order_id}
            basePath="/preservacao"
          />
        </div>

        <Separator orientation="vertical" className="h-5 bg-cream-200 hidden sm:block" />

        {/* Nome + ID — em mobile ocupa o resto da linha do topo (ao lado da seta
            de voltar e do navegador ◀ n/N ▶) e trunca com "…" se for comprido; o
            estado e Contactada/Nota descem para a linha de baixo. Em sm+ é flex-1
            como antes. */}
        <div className="flex-1 min-w-0">
          {/* Em mobile o nome é tocável para copiar o ID (a linha do #ID fica
              escondida para poupar altura); em desktop o #ID continua visível
              por baixo. */}
          <div className="flex items-center gap-1.5 min-w-0">
            <h1
              onClick={copyId}
              title="Tocar para copiar o ID da encomenda"
              className="text-sm sm:text-base font-semibold text-cocoa-900 truncate leading-tight cursor-pointer"
            >
              {local.client_name}
            </h1>
            {copied && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
          </div>
          <div className="flex items-center gap-2 leading-tight">
            <button
              onClick={copyId}
              className="hidden sm:flex font-mono text-[10px] text-cocoa-500 hover:text-cocoa-900 transition-colors items-center gap-1"
              title="Copiar ID"
            >
              #{local.order_id}
              {copied && <Check className="h-3 w-3 text-green-600" />}
            </button>
            <Popover
              open={orderIdPopoverOpen}
              onOpenChange={(v) => { setOrderIdPopoverOpen(v); if (v) setOrderIdDraft(local.order_id); }}
            >
              <PopoverTrigger
                className="hidden sm:inline text-cocoa-500 hover:text-cocoa-900 transition-colors"
                title="Editar ID"
              >
                <Pencil className="h-3 w-3" />
              </PopoverTrigger>
              <PopoverContent className="w-80 p-3 space-y-2">
                <Label className="text-xs font-medium text-cocoa-700">ID da encomenda</Label>
                <Input
                  className={inp + " font-mono uppercase tracking-wider"}
                  value={orderIdDraft}
                  onChange={(e) => setOrderIdDraft(e.target.value)}
                  placeholder="16 caracteres alfanuméricos"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveOrderId(); } }}
                />
                <p className="text-[10px] text-cocoa-500 leading-relaxed">
                  Útil para encomendas antigas que já têm um ID atribuído. Tem de ser único.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setOrderIdPopoverOpen(false)}
                    className="h-8 px-3 rounded-lg border border-cream-200 bg-surface text-xs text-cocoa-700 hover:bg-cream-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={saveOrderId}
                    className="h-8 px-3 rounded-lg bg-btn-primary text-btn-primary-fg text-xs font-medium hover:bg-btn-primary-hover transition-colors"
                  >
                    Guardar
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            {/* Tag do serviço — sempre visível quando não é preservação
                normal. A troca faz-se no rodapé do workbench (MetaFooter). */}
            {local.service_type === "recriacao" && (
              <span className="inline-flex items-center rounded-full bg-violet-100 border border-violet-300 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 uppercase tracking-wide shrink-0">
                Recriação
              </span>
            )}
            {local.service_type === "emoldurar_secas" && (
              <span className="inline-flex items-center rounded-full bg-amber-100 border border-amber-300 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 uppercase tracking-wide shrink-0">
                Secas
              </span>
            )}
          </div>
        </div>

        {/* Quebra só em mobile: linha 1 = seta + nome + Nota (ícone); estado,
            Contactada e setas descem para a linha 2. É `order-1` para vir depois
            da Nota (order-0) na ordenação do flex-wrap. sm:order-none é inócuo
            (o elemento é sm:hidden). */}
        <div className="order-1 sm:order-none basis-full h-0 sm:hidden" aria-hidden />

        {/* Alertas de evento: escondidos no cabeçalho em mobile (o hero já mostra
            o mesmo aviso a vermelho por baixo da data) para poupar espaço. */}
        {overdueEvent && (
          <div className="hidden sm:flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-600 font-medium shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" />
            Evento há {Math.abs(daysUntilEvent!)}d
          </div>
        )}
        {soonEvent && (
          <div className="hidden sm:flex items-center gap-1 rounded-lg bg-amber-200 border border-amber-400 px-2 py-1 text-xs text-amber-900 font-bold shrink-0">
            <Clock className="h-3.5 w-3.5" />
            {daysUntilEvent === 0 ? "Evento hoje" : `Evento em ${daysUntilEvent}d`}
          </div>
        )}

        {/* Em mobile o estado fica na linha 2 (order-1, depois da quebra) e cresce
            para preencher o espaço livre (flex-1), truncando o texto se preciso —
            sem scroll horizontal. Em sm+ é fixo (w-56) e volta à ordem natural. */}
        <div className="order-1 sm:order-none flex-1 min-w-0 sm:flex-none sm:w-56">
          <StatusSelect value={local.status} onChange={onStatusChange} serviceType={local.service_type} />
        </div>

        {/* Prompts (Contactada / 40% / 30%): em mobile ficam na linha 2 (order-1);
            em sm+ `contents` dissolve o grupo e voltam a ser filhos directos na
            ordem natural. */}
        {(showContactadaPrompt || show40Prompt || show30Prompt) && (
          <div className="order-1 sm:order-none sm:contents flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {showContactadaPrompt && (
              <CheckRow
                label="Contactada"
                checked={local.contacted}
                onChange={(v) => update("contacted", v)}
              />
            )}
            {show40Prompt && (
              <CheckRow
                label="40% pedidos?"
                checked={local.payment_40_requested}
                onChange={(v) => update("payment_40_requested", v)}
              />
            )}
            {show30Prompt && (
              <CheckRow
                label="30% pedidos?"
                checked={local.payment_30_requested}
                onChange={(v) => update("payment_30_requested", v)}
              />
            )}
          </div>
        )}

        <div className="hidden sm:block w-24 shrink-0 text-right text-xs">
          {saveState === "saving" && (
            <span className="flex items-center justify-end gap-1 text-cocoa-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              A guardar…
            </span>
          )}
          {saveState === "saved" && (
            <span className="flex items-center justify-end gap-1 text-green-600">
              <Check className="h-3 w-3" />
              Guardado
            </span>
          )}
        </div>

        {/* Sticky note "post-it" — botão amarelo flutuante */}
        <StickyNoteButton
          value={local.sticky_note ?? ""}
          onSave={(v) => update("sticky_note", v.trim() || null)}
          title="Nota da encomenda"
          label="Nota da encomenda"
          placeholder="Detalhe importante sobre esta encomenda…"
        />

        {canEdit && (
          <button
            type="button"
            onClick={onArchive}
            className="shrink-0 hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-200 bg-surface text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
            title="Arquivar esta encomenda"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Arquivar</span>
          </button>
        )}
      </div>
    </header>
  );
}

/* Cliente repetido — aviso informativo com links. NUNCA bloqueia:
   a mesma pessoa pode fazer várias encomendas (regra da Maria). */
export function DuplicatesBanner({ duplicateOrders }: { duplicateOrders: DuplicateOrderInfo[] }) {
  if (duplicateOrders.length === 0) return null;
  return (
    <div className="border-b border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/30 px-3 sm:px-4 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-sky-900 dark:text-sky-200">
      <span className="font-medium shrink-0">
        🌸 Cliente repetido — {duplicateOrders.length === 1
          ? "tem outra encomenda"
          : `tem ${duplicateOrders.length} outras encomendas`}:
      </span>
      {duplicateOrders.map((d) => (
        <Link
          key={d.id}
          href={`/preservacao/${d.order_id}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 dark:border-sky-800 bg-surface px-2 py-0.5 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors"
          title={`${d.client_name} — coincide por ${d.matchedBy}`}
        >
          <span className="font-mono">#{d.order_id.slice(0, 6)}</span>
          <span>{STATUS_LABELS[d.status] ?? d.status}</span>
          {d.event_date && (
            <span className="text-sky-700 dark:text-sky-300">
              {format(parseISO(d.event_date), "dd/MM/yyyy")}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
