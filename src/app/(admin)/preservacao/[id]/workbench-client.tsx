"use client";

// Workbench de Preservação — orquestrador. O estado partilhado (autosave
// com debounce, diálogos de confirmação, transições de estado/pagamento)
// vive aqui; a apresentação de cada secção vive em ./_components/
// (refactor da sessão 128, no espírito do refactor das Finanças na 114):
//   layout.tsx        → Card, Grid2, Field, HeroField, CheckRow, inp/sel/…
//   fields.tsx        → StatusSelect, ShippingRow, InventorySection, …
//   budget-badges.tsx → BudgetSnapshotBadge, ProductionCostBadge
//   shared.ts         → UpdateFn/ClientUpdateFn, toDateInput, flags derivadas
//   header.tsx        → header fixo + faixa de cliente repetido
//   comms-card.tsx    → Comunicações (contactos, templates, Gmail/WhatsApp)
//   gallery-cards.tsx → Inventário das flores + Galeria de inspiração
//   hero.tsx          → foto + nome + atalhos Drive/Calendar + evento
//   alerts.tsx        → fatura em falta + aprovação pendente
//   flowers-card.tsx  → congelador, moldura, extras, peças extra
//   shipping-card.tsx → envio das flores + receção do quadro + prazo
//   origin-card.tsx   → como conheceu a FBR + notas
//   finance-card.tsx  → orçamento, pagamento, faturas
//   partnership-card.tsx → parceiro + comissão
//   closing-cards.tsx → entrega e feedback, cupão 5%, rodapé de datas
//   dialogs.tsx       → os 5 diálogos (pagamento, edição de campo do
//                       cliente, lembretes 40/30%, data de entrega, arquivar)

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { startNavigationProgress } from "@/components/navigation-progress";
import { AlertTriangle, CheckSquare } from "lucide-react";
import { updateOrderAction, deleteOrderAction } from "../actions";
import WorkbenchTasksBlock from "@/components/workbench-tasks-block";
import { computeAmountOptionsFromBudget } from "@/lib/task-templates";
import type { PartnerOption } from "@/components/partner-combobox";
import type { Order, OrderUpdate, PaymentStatus } from "@/types/database";
import type { Task, TaskTemplate } from "@/types/tasks";
import { Card } from "./_components/layout";
import {
  toDateInput,
  computeEventFlags,
  type DuplicateOrderInfo,
} from "./_components/shared";
import { WorkbenchHeader, DuplicatesBanner } from "./_components/header";
import { CommsCard } from "./_components/comms-card";
import { InventoryCard, GalleryCard } from "./_components/gallery-cards";
import { HeroSection } from "./_components/hero";
import { MissingInvoiceAlert, ApprovalPendingAlert } from "./_components/alerts";
import { FlowersCard } from "./_components/flowers-card";
import { ShippingCard } from "./_components/shipping-card";
import { OriginCard } from "./_components/origin-card";
import { FinanceCard } from "./_components/finance-card";
import { PartnershipCard } from "./_components/partnership-card";
import {
  DeliveryFeedbackCard,
  CouponCard,
  MetaFooter,
} from "./_components/closing-cards";
import {
  PaymentChangeDialog,
  ClientEditDialog,
  PaymentReminderDialog,
  DeliveryDateDialog,
  ArchiveDialog,
  type ClientEditRequest,
} from "./_components/dialogs";

// O page.tsx importa este tipo daqui — mantém-se o re-export.
export type { DuplicateOrderInfo } from "./_components/shared";

export default function WorkbenchClient({
  order,
  canEdit,
  partners = [],
  taskTemplates = [],
  orderTasks = [],
  currentEmail = "",
  linkedVoucherCode = null,
  duplicateOrders = [],
}: {
  order: Order;
  canEdit: boolean;
  partners?: PartnerOption[];
  taskTemplates?: TaskTemplate[];
  orderTasks?: Task[];
  currentEmail?: string;
  /** Código de vale existente quando `gift_voucher_code` corresponde a um vale activo. */
  linkedVoucherCode?: string | null;
  duplicateOrders?: DuplicateOrderInfo[];
}) {
  const router = useRouter();
  const [local, setLocal] = useState<Order>(order);
  // Padrão React: reset de estado derivado quando o prop `order` muda
  // (ex: o `router.refresh()` traz novo snapshot do servidor).
  const [trackedOrderUpdatedAt, setTrackedOrderUpdatedAt] = useState(order.updated_at);
  const pendingRef = useRef<OrderUpdate>({});
  if (order.updated_at !== trackedOrderUpdatedAt) {
    setTrackedOrderUpdatedAt(order.updated_at);
    // Não sobrescrever campos que o utilizador está a editar agora —
    // mantém local para qualquer chave em pendingRef (ainda por sincronizar).
    setLocal((current) => {
      const merged = { ...order };
      for (const key of Object.keys(pendingRef.current)) {
        (merged as unknown as Record<string, unknown>)[key] = (current as unknown as Record<string, unknown>)[key];
      }
      return merged;
    });
  }
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  // Diálogo de mudança de pagamento (alerta para comprovativo + NIF)
  const [paymentDialog, setPaymentDialog] = useState<null | { newStatus: PaymentStatus }>(null);
  const [dialogNeedsInvoice, setDialogNeedsInvoice] = useState(false);
  const [dialogNif, setDialogNif] = useState("");

  // Diálogo de "Quadro recebido" — pede data de entrega
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryDateDraft, setDeliveryDateDraft] = useState("");

  // Diálogos de lembrete de pagamento (40% / 30%) — abrem quando se passa
  // para "flores_recebidas"/"flores_na_prensa" (40%) ou "a_ser_fotografado"/
  // "quadro_pronto" (30%). A Maria responde "Já pedi" ou "Lembra-me depois".
  const [paymentReminderDialog, setPaymentReminderDialog] = useState<null | {
    kind: "40" | "30";
    nextStatus: Order["status"];
  }>(null);

  // Confirmação ao alterar campos preenchidos pelo cliente — protege contra cliques acidentais.
  const [clientEditDialog, setClientEditDialog] = useState<ClientEditRequest | null>(null);

  // Diálogo de arquivar (soft delete)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);

  async function handleArchive() {
    setArchiving(true);
    try {
      await deleteOrderAction(order.id);
      startNavigationProgress();
      router.push("/preservacao");
    } catch (err) {
      console.error(err);
      setArchiving(false);
    }
  }

  const flush = useCallback(async () => {
    const updates = { ...pendingRef.current };
    if (Object.keys(updates).length === 0) return;
    pendingRef.current = {};
    clearTimeout(timerRef.current);
    setSaveState("saving");
    try {
      const updated = await updateOrderAction(order.id, updates);
      // Mantém qualquer letra/escolha digitada DURANTE este await — pendingRef
      // já tem essas mudanças, então preservamos os valores do local actual
      // nas chaves em pendingRef (ainda por enviar).
      setLocal((current) => {
        const merged = { ...updated };
        for (const key of Object.keys(pendingRef.current)) {
          (merged as unknown as Record<string, unknown>)[key] = (current as unknown as Record<string, unknown>)[key];
        }
        return merged;
      });
      setSaveState("saved");
      router.refresh();
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("idle");
    }
  }, [order.id, router]);

  function update<K extends keyof OrderUpdate>(key: K, value: OrderUpdate[K]) {
    setLocal((prev) => ({ ...prev, [key]: value }));
    pendingRef.current = { ...pendingRef.current, [key]: value };
    setSaveState("idle");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 900);
  }

  // Atalho para campos preenchidos pelo cliente: pede confirmação antes de aplicar.
  // Razão: evitar alterações acidentais por cliques sem querer numa dropdown/data.
  function clientUpdate<K extends keyof OrderUpdate>(
    key: K,
    newValue: OrderUpdate[K],
    label: string,
    formatter?: (v: OrderUpdate[K]) => string,
  ) {
    const oldValue = local[key as keyof Order] as unknown as OrderUpdate[K];
    if (newValue === oldValue) return;
    const fmt = formatter ?? ((v: OrderUpdate[K]) => (v === null || v === undefined || v === "" ? "—" : String(v)));
    setClientEditDialog({
      label,
      oldDisplay: fmt(oldValue),
      newDisplay: fmt(newValue),
      apply: () => update(key, newValue),
    });
  }

  function confirmClientEdit() {
    clientEditDialog?.apply();
    setClientEditDialog(null);
  }

  function onStatusChange(newStatus: Order["status"]) {
    if (newStatus === local.status) return;

    // Pedido dos 40% — quando se passa para flores_recebidas/flores_na_prensa
    if (
      (newStatus === "flores_recebidas" || newStatus === "flores_na_prensa") &&
      !local.payment_40_requested
    ) {
      setPaymentReminderDialog({ kind: "40", nextStatus: newStatus });
      return; // só aplica o status depois da resposta
    }

    // Pedido dos 30% — quando se passa para a_ser_fotografado/quadro_pronto
    if (
      (newStatus === "a_ser_fotografado" || newStatus === "quadro_pronto") &&
      !local.payment_30_requested
    ) {
      setPaymentReminderDialog({ kind: "30", nextStatus: newStatus });
      return;
    }

    if (newStatus === "quadro_recebido" && !local.frame_delivery_date) {
      setDeliveryDateDraft(toDateInput(new Date().toISOString()));
      setDeliveryDialogOpen(true);
    }
    update("status", newStatus);
  }

  function confirmPaymentReminder(alreadyAsked: boolean) {
    if (!paymentReminderDialog) return;
    const { kind, nextStatus } = paymentReminderDialog;
    const updates: OrderUpdate = { status: nextStatus };
    if (alreadyAsked) {
      if (kind === "40") updates.payment_40_requested = true;
      else updates.payment_30_requested = true;
    }
    // Aplica numa transição
    setLocal((prev) => ({ ...prev, ...updates }));
    pendingRef.current = { ...pendingRef.current, ...updates };
    clearTimeout(timerRef.current);
    setPaymentReminderDialog(null);
    flush();
    // Se for o quadro_recebido cadeia, dispara o seguinte diálogo
    if (nextStatus === "quadro_recebido" && !local.frame_delivery_date) {
      setDeliveryDateDraft(toDateInput(new Date().toISOString()));
      setDeliveryDialogOpen(true);
    }
  }

  function confirmDeliveryDialog() {
    const date = deliveryDateDraft.trim();
    if (date) update("frame_delivery_date", date);
    setDeliveryDialogOpen(false);
  }

  function onPaymentStatusChange(newStatus: PaymentStatus) {
    if (newStatus === local.payment_status) return;
    if (newStatus === "100_pago" || newStatus === "70_pago" || newStatus === "30_pago") {
      setDialogNeedsInvoice(local.needs_invoice);
      setDialogNif(local.nif ?? "");
      setPaymentDialog({ newStatus });
    } else {
      update("payment_status", newStatus);
    }
  }

  function confirmPaymentDialog() {
    if (!paymentDialog) return;
    const updates: OrderUpdate = { payment_status: paymentDialog.newStatus };
    if (dialogNeedsInvoice !== local.needs_invoice) updates.needs_invoice = dialogNeedsInvoice;
    if (dialogNeedsInvoice && dialogNif.trim() !== (local.nif ?? "").trim()) {
      updates.nif = dialogNif.trim() || null;
    }
    setLocal((prev) => ({ ...prev, ...updates }));
    pendingRef.current = { ...pendingRef.current, ...updates };
    clearTimeout(timerRef.current);
    setPaymentDialog(null);
    flush();
  }

  // Escolha do parceiro recomendador: aplica partner_id + auto-preenchimento
  // da comissão numa só transição de autosave.
  function onPartnerChange(id: string | null) {
    const updates: Partial<OrderUpdate> = { partner_id: id };
    // Auto-preenche 10% do orçamento quando se escolhe um parceiro
    // (mas só se ainda não há comissão definida — para não sobrescrever
    // um valor que a Maria já editou manualmente).
    if (id && (local.partner_commission === null || local.partner_commission === 0) && local.budget) {
      updates.partner_commission = Math.round(local.budget * 0.1 * 100) / 100;
    }
    if (id && local.partner_commission_status === "na") {
      updates.partner_commission_status = "a_aguardar";
    }
    // Aplica todos numa transição
    setLocal((prev) => ({ ...prev, ...updates }));
    pendingRef.current = { ...pendingRef.current, ...updates };
    setSaveState("idle");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 900);
  }

  const { daysUntilEvent, overdueEvent, soonEvent } = computeEventFlags(local);

  // ── Lembretes no cabeçalho (Contactada / 40% / 30%) ────────
  // "Contactada" só faz sentido enquanto não há pagamento — assim que o
  // cliente paga qualquer tranche, o cliente já foi obviamente contactado.
  const showContactadaPrompt = local.payment_status === "100_por_pagar";
  // "40% pedidos?" aparece quando a encomenda chegou a flores_recebidas e
  // ainda não recebemos 70%+ pago; desaparece assim que payment_status
  // passa a 70_pago / 100_pago. Estado cancelado nunca mostra.
  const reachedFloresRecebidas = (
    [
      "flores_recebidas", "flores_na_prensa", "reconstrucao_botanica",
      "a_compor_design", "a_aguardar_aprovacao", "a_finalizar_quadro",
      "a_ser_emoldurado", "emoldurado", "a_ser_fotografado",
      "quadro_pronto", "quadro_enviado", "quadro_recebido",
    ] as Order["status"][]
  ).includes(local.status);
  const reachedQuadroPronto = (
    ["quadro_pronto", "quadro_enviado", "quadro_recebido"] as Order["status"][]
  ).includes(local.status);
  const show40Prompt =
    reachedFloresRecebidas &&
    local.payment_status !== "70_pago" &&
    local.payment_status !== "100_pago";
  // "30% pedidos?" aparece em quadro_pronto+ até payment_status=100_pago.
  const show30Prompt =
    reachedQuadroPronto && local.payment_status !== "100_pago";

  return (
    <div className="flex flex-col h-full bg-cream-50">

      {!canEdit && (
        <div className="shrink-0 bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Modo leitura.</strong> Não tens permissão para editar encomendas. Para alterações, fala com a MJ ou o António.
          </span>
        </div>
      )}

      <fieldset disabled={!canEdit} className="contents">

      <WorkbenchHeader
        local={local}
        canEdit={canEdit}
        update={update}
        onStatusChange={onStatusChange}
        daysUntilEvent={daysUntilEvent}
        overdueEvent={overdueEvent}
        soonEvent={soonEvent}
        showContactadaPrompt={showContactadaPrompt}
        show40Prompt={show40Prompt}
        show30Prompt={show30Prompt}
        saveState={saveState}
        onArchive={() => setArchiveDialogOpen(true)}
      />

      <DuplicatesBanner duplicateOrders={duplicateOrders} />

      {/* ── Corpo: 3 colunas em desktop, lista plana em mobile ──
          As 3 colunas usam `display: contents` em mobile (<lg) para deixar
          os cards individuais ficarem como filhos directos da grid. Cada
          card recebe um `order-N` em mobile (e `lg:order-none` em desktop)
          para a Maria conseguir reordenar Finanças → Comunicações → Envio
          → Flores independentemente da coluna em que vivem em desktop. */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto p-2 sm:p-4 lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">

            {/* ═══════════════════════════════
                COLUNA ESQUERDA — COMUNICAÇÕES + GALERIA (sticky em desktop)
                Em mobile usa `display: contents` para os cards subirem
                à grid e aceitarem os `order-N` individuais.
            ═══════════════════════════════ */}
            <aside className="contents lg:block lg:col-span-3">
              <div className="contents lg:block lg:space-y-4 lg:space-y-5 lg:sticky lg:top-2">
                <CommsCard local={local} canEdit={canEdit} update={update} clientUpdate={clientUpdate} />
                <InventoryCard local={local} update={update} />
                <GalleryCard local={local} update={update} />
              </div>
            </aside>

            {/* ═══════════════════════════════
                COLUNA DO MEIO — DETALHES PRINCIPAIS
                Em mobile usa `display: contents` (ver nota em cima).
            ═══════════════════════════════ */}
            <main className="contents lg:block lg:col-span-6 lg:space-y-4 lg:space-y-5">
              <HeroSection local={local} setLocal={setLocal} update={update} clientUpdate={clientUpdate} />
              <MissingInvoiceAlert local={local} />
              <ApprovalPendingAlert local={local} update={update} />
              <FlowersCard local={local} update={update} clientUpdate={clientUpdate} />
              <ShippingCard local={local} update={update} clientUpdate={clientUpdate} />
              <OriginCard local={local} update={update} clientUpdate={clientUpdate} linkedVoucherCode={linkedVoucherCode} />
            </main>

            {/* ═══════════════════════════════
                COLUNA DIREITA — FINANÇAS / PARCERIA / ENTREGA / CUPÃO
                Em mobile usa `display: contents` (ver nota em cima).
            ═══════════════════════════════ */}
            <aside className="contents lg:block lg:col-span-3 lg:space-y-4 lg:space-y-5">

              <Card
                title="Tarefas"
                icon={<CheckSquare className="h-3.5 w-3.5" />}
                accent="indigo"
                className="order-7 lg:order-none"
              >
                <WorkbenchTasksBlock
                  link={{ type: "order", id: local.id }}
                  context={{
                    client_name: local.client_name,
                    nif: local.nif,
                    partner_name: partners.find((p) => p.id === local.partner_id)?.name ?? null,
                    partner_commission: local.partner_commission,
                  }}
                  paymentOptions={computeAmountOptionsFromBudget(local.budget ?? null)}
                  templates={taskTemplates}
                  initialTasks={orderTasks}
                  currentEmail={currentEmail}
                  canEdit={canEdit}
                />
              </Card>

              <FinanceCard local={local} canEdit={canEdit} update={update} onPaymentStatusChange={onPaymentStatusChange} />
              <PartnershipCard local={local} partners={partners} update={update} onPartnerChange={onPartnerChange} />
              <DeliveryFeedbackCard local={local} update={update} />
              <CouponCard local={local} update={update} />
              <MetaFooter local={local} />

            </aside>

          </div>
        </div>
      </div>

      <PaymentChangeDialog
        dialog={paymentDialog}
        local={local}
        needsInvoice={dialogNeedsInvoice}
        setNeedsInvoice={setDialogNeedsInvoice}
        nif={dialogNif}
        setNif={setDialogNif}
        onClose={() => setPaymentDialog(null)}
        onConfirm={confirmPaymentDialog}
      />

      <ClientEditDialog
        dialog={clientEditDialog}
        onClose={() => setClientEditDialog(null)}
        onConfirm={confirmClientEdit}
      />

      <PaymentReminderDialog
        dialog={paymentReminderDialog}
        onClose={() => setPaymentReminderDialog(null)}
        onConfirm={confirmPaymentReminder}
      />

      <DeliveryDateDialog
        open={deliveryDialogOpen}
        onOpenChange={setDeliveryDialogOpen}
        draft={deliveryDateDraft}
        setDraft={setDeliveryDateDraft}
        onConfirm={confirmDeliveryDialog}
      />

      <ArchiveDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        archiving={archiving}
        onConfirm={handleArchive}
      />

      </fieldset>
    </div>
  );
}
