"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import {
  ArrowLeft,
  Loader2,
  Check,
  Copy,
  Mail,
  MessageCircle,
  Gift,
  User,
  Send,
  Wallet,
  CalendarDays,
  StickyNote,
  Receipt,
  Compass,
  AlertTriangle,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { updateVoucherAction, deleteVoucherAction } from "../actions";
import {
  type Voucher,
  type VoucherUpdate,
  type VoucherPaymentStatus,
  type VoucherSendStatus,
  type VoucherUsageStatus,
  type VoucherDeliveryRecipient,
  type VoucherDeliveryFormat,
  type VoucherDeliveryChannel,
  VOUCHER_PAYMENT_STATUS_LABELS,
  VOUCHER_PAYMENT_STATUS_COLORS,
  VOUCHER_SEND_STATUS_LABELS,
  VOUCHER_SEND_STATUS_COLORS,
  VOUCHER_USAGE_STATUS_LABELS,
  VOUCHER_USAGE_STATUS_COLORS,
  VOUCHER_DELIVERY_RECIPIENT_LABELS,
  VOUCHER_DELIVERY_FORMAT_LABELS,
  VOUCHER_DELIVERY_CHANNEL_LABELS,
  VOUCHER_PHYSICAL_BASE_COST,
} from "@/types/voucher";
import {
  CONTACT_PREFERENCE_LABELS,
  HOW_FOUND_FBR_LABELS,
  HOW_FOUND_FBR_COLORS,
  SIM_NAO_LABELS,
  type ContactPreference,
  type HowFoundFBR,
} from "@/types/database";
import { isExpired, isExpiringSoon, monthsUntilExpiry } from "@/lib/supabase/vouchers";

// ── Formatação ────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(parseISO(dateStr), "dd/MM/yyyy", { locale: pt });
  } catch {
    return "—";
  }
}

function formatEuro(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

interface Props {
  voucher: Voucher;
  canEdit: boolean;
}

export default function VoucherWorkbenchClient({ voucher, canEdit }: Props) {
  const router = useRouter();
  const [data, setData] = useState<Voucher>(voucher);
  const [isPending, startTransition] = useTransition();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<VoucherPaymentStatus | null>(null);
  const [tempNif, setTempNif] = useState("");
  const [tempNeedsInvoice, setTempNeedsInvoice] = useState<"sim" | "nao">("nao");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Update genérico — actualiza optimisticamente, manda Server Action e recarrega.
  function updateField<K extends keyof Voucher>(key: K, value: Voucher[K]) {
    if (!canEdit) return;
    setData((d) => ({ ...d, [key]: value }));
    startTransition(async () => {
      try {
        const updates = { [key]: value } as VoucherUpdate;
        await updateVoucherAction(voucher.id, updates);
        router.refresh();
      } catch (err) {
        console.error(err);
        setData((d) => ({ ...d, [key]: voucher[key] }));
      }
    });
  }

  // Pagamento tem confirmação especial (lembra fatura/comprovativo)
  function requestPaymentChange(newStatus: VoucherPaymentStatus) {
    if (newStatus === data.payment_status) return;
    if (newStatus === "100_pago") {
      // Pré-preencher dialog
      setTempNif(data.nif ?? "");
      setTempNeedsInvoice(data.needs_invoice ? "sim" : "nao");
      setPendingPayment(newStatus);
      setPaymentDialogOpen(true);
    } else {
      updateField("payment_status", newStatus);
    }
  }

  function confirmPaymentChange() {
    if (!pendingPayment) return;
    const updates: VoucherUpdate = {
      payment_status: pendingPayment,
      needs_invoice: tempNeedsInvoice === "sim",
      nif: tempNeedsInvoice === "sim" ? tempNif.trim() || null : null,
    };
    setData((d) => ({ ...d, ...updates }));
    setPaymentDialogOpen(false);
    setPendingPayment(null);
    startTransition(async () => {
      try {
        await updateVoucherAction(voucher.id, updates);
        router.refresh();
      } catch (err) {
        console.error(err);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteVoucherAction(voucher.id);
        router.push("/vale-presente");
      } catch (err) {
        console.error(err);
      }
    });
  }

  function copyCode() {
    navigator.clipboard.writeText(data.code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    });
  }

  const expired = isExpired(data.expiry_date);
  const expiringSoon = isExpiringSoon(data.expiry_date);
  const monthsLeft = monthsUntilExpiry(data.expiry_date);

  const inputCls =
    "h-9 text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F] rounded-lg";
  const triggerCls =
    "h-9 text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F] rounded-lg";

  return (
    <div className="flex flex-col h-full bg-[#F7F4F0]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-[#E8E0D5] bg-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/vale-presente"
            className="flex items-center gap-1.5 text-sm text-[#8B7355] hover:text-[#3D2B1F] transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Vales</span>
          </Link>
          <div className="h-6 w-px bg-[#E8E0D5]" />
          <button
            onClick={copyCode}
            className="flex items-center gap-2 rounded-md border border-[#E8E0D5] bg-[#FAF8F5] px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-[#3D2B1F] hover:border-[#3D2B1F] transition-colors"
            title="Copiar código"
          >
            {data.code}
            {copiedCode ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-[#B8A99A]" />
            )}
          </button>
          {!canEdit && (
            <span className="text-[10px] uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-semibold">
              Modo leitura
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 border-red-200 text-red-700 hover:bg-red-50 gap-1.5"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Arquivar
            </Button>
          )}
        </div>
      </div>

      {/* Banner de viewer */}
      {!canEdit && (
        <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Modo leitura — apenas administradores podem editar este vale.
        </div>
      )}

      <fieldset disabled={!canEdit} className="contents">
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
            {/* ── Coluna esquerda: hero + remetente ── */}
            <div className="space-y-4">
              <Hero voucher={data} expired={expired} expiringSoon={expiringSoon} monthsLeft={monthsLeft} />

              <Section title="Remetente" icon={<User className="h-3.5 w-3.5" />} accent="rose">
                <Field label="Nome">
                  <Input
                    value={data.sender_name}
                    onChange={(e) => setData((d) => ({ ...d, sender_name: e.target.value }))}
                    onBlur={(e) => updateField("sender_name", e.target.value.trim())}
                    className={inputCls}
                  />
                </Field>

                <Field label="Contacto preferido">
                  <Select
                    value={data.sender_contact_pref ?? ""}
                    onValueChange={(v) => updateField("sender_contact_pref", v as ContactPreference)}
                  >
                    <SelectTrigger className={triggerCls}>
                      <SelectValue placeholder="—" labels={CONTACT_PREFERENCE_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Email">
                  <div className="flex gap-1.5">
                    <Input
                      type="email"
                      value={data.sender_email ?? ""}
                      onChange={(e) => setData((d) => ({ ...d, sender_email: e.target.value }))}
                      onBlur={(e) => updateField("sender_email", e.target.value.trim() || null)}
                      className={inputCls}
                    />
                    {data.sender_email && (
                      <a
                        href={`mailto:${data.sender_email}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E8E0D5] bg-white text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                        title="Enviar email"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </Field>

                <Field label="Telemóvel">
                  <div className="flex gap-1.5">
                    <Input
                      value={data.sender_phone ?? ""}
                      onChange={(e) => setData((d) => ({ ...d, sender_phone: e.target.value }))}
                      onBlur={(e) => updateField("sender_phone", e.target.value.trim() || null)}
                      className={inputCls}
                    />
                    {data.sender_phone && (
                      <a
                        href={`https://wa.me/${data.sender_phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E8E0D5] bg-white text-green-600 hover:bg-green-50 transition-colors shrink-0"
                        title="Abrir WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </Field>
              </Section>

              <Section title="Origem" icon={<Compass className="h-3.5 w-3.5" />} accent="indigo">
                <Field label="Como conheceu a FBR">
                  <Select
                    value={data.how_found_fbr ?? ""}
                    onValueChange={(v) => updateField("how_found_fbr", v as HowFoundFBR)}
                  >
                    <SelectTrigger
                      className={`${triggerCls} font-medium ${data.how_found_fbr ? HOW_FOUND_FBR_COLORS[data.how_found_fbr] : ""}`}
                    >
                      <SelectValue placeholder="—" labels={HOW_FOUND_FBR_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(HOW_FOUND_FBR_LABELS) as HowFoundFBR[]).map((k) => (
                        <SelectItem key={k} value={k} className="my-0.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${HOW_FOUND_FBR_COLORS[k]}`}>
                            {HOW_FOUND_FBR_LABELS[k]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {(data.how_found_fbr === "florista" || data.how_found_fbr === "outro") && (
                  <Field label={data.how_found_fbr === "florista" ? "Que florista?" : "Especifique"}>
                    <Input
                      value={data.how_found_fbr_other ?? ""}
                      onChange={(e) => setData((d) => ({ ...d, how_found_fbr_other: e.target.value }))}
                      onBlur={(e) => updateField("how_found_fbr_other", e.target.value.trim() || null)}
                      className={inputCls}
                    />
                  </Field>
                )}
              </Section>
            </div>

            {/* ── Coluna do meio: vale + entrega + comentários ── */}
            <div className="space-y-4">
              <Section title="O vale" icon={<Gift className="h-3.5 w-3.5" />} accent="amber">
                <Field label="Nome do destinatário">
                  <Input
                    value={data.recipient_name}
                    onChange={(e) => setData((d) => ({ ...d, recipient_name: e.target.value }))}
                    onBlur={(e) => updateField("recipient_name", e.target.value.trim())}
                    className={inputCls}
                  />
                </Field>

                <Field label="Valor (€)">
                  <Input
                    type="number"
                    min={300}
                    step={10}
                    value={data.amount}
                    onChange={(e) => setData((d) => ({ ...d, amount: Number(e.target.value) }))}
                    onBlur={(e) => updateField("amount", Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>

                <Field label="Mensagem personalizada">
                  <Textarea
                    value={data.message ?? ""}
                    onChange={(e) => setData((d) => ({ ...d, message: e.target.value }))}
                    onBlur={(e) => updateField("message", e.target.value.trim() || null)}
                    rows={4}
                    className="text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F] rounded-lg resize-none"
                  />
                </Field>

                <Field label="Validade">
                  <div className="flex gap-1.5 items-center">
                    <Input
                      type="date"
                      value={data.expiry_date ?? ""}
                      onChange={(e) => updateField("expiry_date", e.target.value)}
                      className={inputCls}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 border-[#E8E0D5] text-xs"
                      onClick={() => {
                        const newDate = new Date();
                        newDate.setFullYear(newDate.getFullYear() + 2);
                        updateField("expiry_date", newDate.toISOString().slice(0, 10));
                      }}
                    >
                      +2 anos
                    </Button>
                  </div>
                  {expired && (
                    <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Vale expirado.
                    </p>
                  )}
                  {!expired && expiringSoon && (
                    <p className="text-[11px] text-amber-700 mt-1">
                      Expira em {monthsLeft} {monthsLeft === 1 ? "mês" : "meses"}.
                    </p>
                  )}
                </Field>
              </Section>

              <Section title="Entrega do vale" icon={<Send className="h-3.5 w-3.5" />} accent="emerald">
                <Field label="Para quem entregar?">
                  <Select
                    value={data.delivery_recipient ?? ""}
                    onValueChange={(v) => updateField("delivery_recipient", v as VoucherDeliveryRecipient)}
                  >
                    <SelectTrigger className={triggerCls}>
                      <SelectValue placeholder="—" labels={VOUCHER_DELIVERY_RECIPIENT_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(VOUCHER_DELIVERY_RECIPIENT_LABELS) as VoucherDeliveryRecipient[]).map((k) => (
                        <SelectItem key={k} value={k}>{VOUCHER_DELIVERY_RECIPIENT_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Formato">
                  <Select
                    value={data.delivery_format ?? ""}
                    onValueChange={(v) => updateField("delivery_format", v as VoucherDeliveryFormat)}
                  >
                    <SelectTrigger className={triggerCls}>
                      <SelectValue placeholder="—" labels={VOUCHER_DELIVERY_FORMAT_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(VOUCHER_DELIVERY_FORMAT_LABELS) as VoucherDeliveryFormat[]).map((k) => (
                        <SelectItem key={k} value={k}>{VOUCHER_DELIVERY_FORMAT_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {data.delivery_format === "digital" && (
                  <Field label="Canal digital">
                    <Select
                      value={data.delivery_channel ?? ""}
                      onValueChange={(v) => updateField("delivery_channel", v as VoucherDeliveryChannel)}
                    >
                      <SelectTrigger className={triggerCls}>
                        <SelectValue placeholder="—" labels={VOUCHER_DELIVERY_CHANNEL_LABELS} />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(VOUCHER_DELIVERY_CHANNEL_LABELS) as VoucherDeliveryChannel[]).map((k) => (
                          <SelectItem key={k} value={k}>{VOUCHER_DELIVERY_CHANNEL_LABELS[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}

                {data.delivery_format === "fisico" && (
                  <Field label={`Custo de envio (€) — base ${VOUCHER_PHYSICAL_BASE_COST}€`}>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={data.delivery_shipping_cost ?? VOUCHER_PHYSICAL_BASE_COST}
                      onChange={(e) => setData((d) => ({ ...d, delivery_shipping_cost: Number(e.target.value) }))}
                      onBlur={(e) => updateField("delivery_shipping_cost", Number(e.target.value))}
                      className={inputCls}
                    />
                  </Field>
                )}
              </Section>

              <Section title="Comentários" icon={<StickyNote className="h-3.5 w-3.5" />} accent="slate">
                <Textarea
                  value={data.comments ?? ""}
                  onChange={(e) => setData((d) => ({ ...d, comments: e.target.value }))}
                  onBlur={(e) => updateField("comments", e.target.value.trim() || null)}
                  rows={4}
                  className="text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F] rounded-lg resize-none"
                  placeholder="Pedidos especiais, observações…"
                />
              </Section>
            </div>

            {/* ── Coluna direita: pagamento + envio + utilização + fatura ── */}
            <div className="space-y-4">
              <Section title="Pagamento" icon={<Wallet className="h-3.5 w-3.5" />} accent="emerald">
                <Field label="Estado">
                  <Select
                    value={data.payment_status}
                    onValueChange={(v) => requestPaymentChange(v as VoucherPaymentStatus)}
                  >
                    <SelectTrigger
                      className={`${triggerCls} font-semibold ${VOUCHER_PAYMENT_STATUS_COLORS[data.payment_status]}`}
                    >
                      <SelectValue labels={VOUCHER_PAYMENT_STATUS_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(VOUCHER_PAYMENT_STATUS_LABELS) as VoucherPaymentStatus[]).map((k) => (
                        <SelectItem key={k} value={k} className="my-0.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${VOUCHER_PAYMENT_STATUS_COLORS[k]}`}>
                            {VOUCHER_PAYMENT_STATUS_LABELS[k]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </Section>

              <Section title="Envio do vale" icon={<Send className="h-3.5 w-3.5" />} accent="sky">
                <Field label="Estado de envio">
                  <Select
                    value={data.send_status}
                    onValueChange={(v) => updateField("send_status", v as VoucherSendStatus)}
                  >
                    <SelectTrigger
                      className={`${triggerCls} font-medium ${VOUCHER_SEND_STATUS_COLORS[data.send_status]}`}
                    >
                      <SelectValue labels={VOUCHER_SEND_STATUS_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(VOUCHER_SEND_STATUS_LABELS) as VoucherSendStatus[]).map((k) => (
                        <SelectItem key={k} value={k} className="my-0.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${VOUCHER_SEND_STATUS_COLORS[k]}`}>
                            {VOUCHER_SEND_STATUS_LABELS[k]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {data.send_status === "agendado" && (
                  <Field label="Data agendada">
                    <Input
                      type="date"
                      value={data.scheduled_send_date ?? ""}
                      onChange={(e) => updateField("scheduled_send_date", e.target.value || null)}
                      className={inputCls}
                    />
                  </Field>
                )}
              </Section>

              <Section title="Utilização" icon={<Sparkles className="h-3.5 w-3.5" />} accent="violet">
                <Field label="Preservação agendada?">
                  <Select
                    value={data.usage_status}
                    onValueChange={(v) => updateField("usage_status", v as VoucherUsageStatus)}
                  >
                    <SelectTrigger
                      className={`${triggerCls} font-medium ${VOUCHER_USAGE_STATUS_COLORS[data.usage_status]}`}
                    >
                      <SelectValue labels={VOUCHER_USAGE_STATUS_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(VOUCHER_USAGE_STATUS_LABELS) as VoucherUsageStatus[]).map((k) => (
                        <SelectItem key={k} value={k} className="my-0.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${VOUCHER_USAGE_STATUS_COLORS[k]}`}>
                            {VOUCHER_USAGE_STATUS_LABELS[k]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-[#B8A99A] mt-1">
                    {data.usage_status === "preservacao_agendada"
                      ? "Não conta para faturação (evita duplicação com a Preservação)."
                      : "Conta para faturação."}
                  </p>
                </Field>
              </Section>

              <Section title="Fatura" icon={<Receipt className="h-3.5 w-3.5" />} accent="orange">
                <Field label="Cliente pediu fatura com NIF?">
                  <Select
                    value={data.needs_invoice ? "sim" : "nao"}
                    onValueChange={(v) => {
                      const needs = v === "sim";
                      updateField("needs_invoice", needs);
                      if (!needs) updateField("nif", null);
                    }}
                  >
                    <SelectTrigger className={triggerCls}>
                      <SelectValue labels={SIM_NAO_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {data.needs_invoice && (
                  <>
                    <Field label="NIF">
                      <Input
                        value={data.nif ?? ""}
                        onChange={(e) => setData((d) => ({ ...d, nif: e.target.value }))}
                        onBlur={(e) => updateField("nif", e.target.value.trim() || null)}
                        placeholder="123456789"
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Anexo (Drive)">
                      <Input
                        value={data.invoice_attachment_url ?? ""}
                        onChange={(e) => setData((d) => ({ ...d, invoice_attachment_url: e.target.value }))}
                        onBlur={(e) => updateField("invoice_attachment_url", e.target.value.trim() || null)}
                        placeholder="https://drive.google.com/…"
                        className={inputCls}
                      />
                    </Field>
                  </>
                )}
              </Section>

              <Section title="Metadata" icon={<CalendarDays className="h-3.5 w-3.5" />} accent="slate">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] uppercase text-[#B8A99A] tracking-wider">Criado</p>
                    <p className="text-[#3D2B1F]">{formatDate(data.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-[#B8A99A] tracking-wider">Última edição</p>
                    <p className="text-[#3D2B1F]">{formatDate(data.updated_at)}</p>
                  </div>
                </div>
              </Section>
            </div>
          </div>

          {isPending && (
            <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full bg-white/95 backdrop-blur border border-[#E8E0D5] px-3 py-1.5 shadow-md text-xs text-[#8B7355]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              A guardar…
            </div>
          )}
        </div>
      </fieldset>

      {/* Diálogo: confirmar pagamento marcado como pago */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar vale como pago?</DialogTitle>
            <DialogDescription>
              Lembra-te de anexar o comprovativo à pasta Drive deste vale e confirma se o cliente pediu fatura com NIF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-medium text-[#8B7355]">Cliente pediu fatura com NIF?</Label>
              <Select value={tempNeedsInvoice} onValueChange={(v) => setTempNeedsInvoice(v as "sim" | "nao")}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue labels={SIM_NAO_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sim">Sim</SelectItem>
                  <SelectItem value="nao">Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tempNeedsInvoice === "sim" && (
              <div>
                <Label className="text-xs font-medium text-[#8B7355]">NIF</Label>
                <Input
                  value={tempNif}
                  onChange={(e) => setTempNif(e.target.value)}
                  placeholder="123456789"
                  className="mt-1.5"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancelar</Button>
            <Button onClick={confirmPaymentChange} className="bg-[#3D2B1F] hover:bg-[#2C1F15]">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: arquivar vale */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Arquivar este vale?</DialogTitle>
            <DialogDescription>
              O vale fica arquivado e deixa de aparecer na lista. Pode ser recuperado mais tarde por um admin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Arquivar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────

function Hero({
  voucher,
  expired,
  expiringSoon,
  monthsLeft,
}: {
  voucher: Voucher;
  expired: boolean;
  expiringSoon: boolean;
  monthsLeft: number;
}) {
  return (
    <div className="rounded-2xl border border-[#E8E0D5] bg-gradient-to-br from-amber-50 via-rose-50 to-white p-5 overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-md shrink-0">
          <Gift className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.15em] text-[#8B7355] font-bold">
            Vale-Presente
          </p>
          <p className="font-['TanMemories'] text-3xl text-[#3D2B1F] leading-tight mt-0.5">
            {formatEuro(voucher.amount)}
          </p>
          <p className="text-xs text-[#8B7355] mt-1 truncate">
            de <span className="font-semibold text-[#3D2B1F]">{voucher.sender_name || "—"}</span>
            {" "}para{" "}
            <span className="font-semibold text-[#3D2B1F]">{voucher.recipient_name || "—"}</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${VOUCHER_PAYMENT_STATUS_COLORS[voucher.payment_status]}`}>
          {VOUCHER_PAYMENT_STATUS_LABELS[voucher.payment_status]}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${VOUCHER_SEND_STATUS_COLORS[voucher.send_status]}`}>
          {VOUCHER_SEND_STATUS_LABELS[voucher.send_status]}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${VOUCHER_USAGE_STATUS_COLORS[voucher.usage_status]}`}>
          {VOUCHER_USAGE_STATUS_LABELS[voucher.usage_status]}
        </span>
        {expired && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-red-100 text-red-700 border-red-300">
            <AlertTriangle className="h-3 w-3" />
            Expirado
          </span>
        )}
        {!expired && expiringSoon && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-amber-100 text-amber-800 border-amber-300">
            <AlertTriangle className="h-3 w-3" />
            Expira em {monthsLeft} {monthsLeft === 1 ? "mês" : "meses"}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Section / Field helpers (mesma estética do workbench da Preservação) ──

type Accent = "rose" | "amber" | "emerald" | "indigo" | "slate" | "sky" | "violet" | "orange";

const ACCENT_STYLES: Record<Accent, { border: string; iconBg: string; iconColor: string }> = {
  rose:    { border: "border-l-rose-300",    iconBg: "bg-rose-50",    iconColor: "text-rose-500" },
  amber:   { border: "border-l-amber-300",   iconBg: "bg-amber-50",   iconColor: "text-amber-600" },
  emerald: { border: "border-l-emerald-300", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  indigo:  { border: "border-l-indigo-300",  iconBg: "bg-indigo-50",  iconColor: "text-indigo-600" },
  slate:   { border: "border-l-slate-300",   iconBg: "bg-slate-50",   iconColor: "text-slate-500" },
  sky:     { border: "border-l-sky-300",     iconBg: "bg-sky-50",     iconColor: "text-sky-600" },
  violet:  { border: "border-l-violet-300",  iconBg: "bg-violet-50",  iconColor: "text-violet-600" },
  orange:  { border: "border-l-orange-300",  iconBg: "bg-orange-50",  iconColor: "text-orange-600" },
};

function Section({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  accent: Accent;
  children: React.ReactNode;
}) {
  const a = ACCENT_STYLES[accent];
  return (
    <div className={`rounded-2xl border border-[#E8E0D5] bg-white border-l-4 ${a.border} shadow-[0_1px_2px_rgba(61,43,31,0.04)] overflow-hidden`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#F0EAE0]">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${a.iconBg} ${a.iconColor}`}>
          {icon}
        </span>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8B7355]">
          {title}
        </p>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-[#8B7355]">{label}</Label>
      {children}
    </div>
  );
}
