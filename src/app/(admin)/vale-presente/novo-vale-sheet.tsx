"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  Gift,
  Send,
  Compass,
  StickyNote,
  Loader2,
  Mail,
  MessageCircle,
  Euro,
} from "lucide-react";
import { createVoucherAction } from "./actions";
import {
  type VoucherInsert,
  VOUCHER_DELIVERY_RECIPIENT_LABELS,
  VOUCHER_DELIVERY_FORMAT_LABELS,
  VOUCHER_DELIVERY_CHANNEL_LABELS,
  VOUCHER_PHYSICAL_BASE_COST,
} from "@/types/voucher";
import { HOW_FOUND_FBR_LABELS, HOW_FOUND_FBR_COLORS } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const INITIAL_FORM: VoucherInsert = {
  sender_name: "",
  sender_contact_pref: undefined,
  sender_email: "",
  sender_phone: "",
  recipient_name: "",
  message: "",
  amount: 300,
  delivery_recipient: undefined,
  delivery_format: undefined,
  delivery_channel: undefined,
  delivery_shipping_cost: undefined,
  recipient_contact: "",
  recipient_address: "",
  ideal_send_date: null,
  comments: "",
  how_found_fbr: undefined,
  payment_status: "100_por_pagar",
  send_status: "nao_agendado",
  usage_status: "preservacao_nao_agendada",
};

export default function NovoValeSheet({ open, onOpenChange, onSuccess }: Props) {
  const [form, setForm] = useState<VoucherInsert>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function set<K extends keyof VoucherInsert>(key: K, value: VoucherInsert[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: "" }));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.sender_name?.trim()) errors.sender_name = "Nome do remetente obrigatório";
    if (!form.recipient_name?.trim()) errors.recipient_name = "Nome do destinatário obrigatório";
    if (!form.sender_contact_pref) errors.sender_contact_pref = "Indica como prefere ser contactado";
    // E-mail é sempre obrigatório (contacto alternativo segundo o PDF)
    if (!form.sender_email?.trim()) errors.sender_email = "E-mail de contacto obrigatório";
    // Telemóvel só é obrigatório se WhatsApp
    if (form.sender_contact_pref === "whatsapp" && !form.sender_phone?.trim())
      errors.sender_phone = "Telemóvel obrigatório quando o contacto preferido é WhatsApp";
    if (!form.amount || form.amount < 300)
      errors.amount = "O valor mínimo é de 300€, correspondente ao quadro mais pequeno";
    if (!form.delivery_recipient) errors.delivery_recipient = "Indica para quem entregar o vale";
    if (!form.delivery_format) errors.delivery_format = "Indica o tipo de vale";
    if (form.delivery_format === "digital" && !form.delivery_channel)
      errors.delivery_channel = "Indica se é por email ou WhatsApp";
    // Quando o vale vai para o destinatário, há campos extra obrigatórios
    if (form.delivery_recipient === "destinatario") {
      if (form.delivery_format === "digital" && !form.recipient_contact?.trim())
        errors.recipient_contact = "E-mail ou WhatsApp do destinatário obrigatório";
      if (form.delivery_format === "fisico" && !form.recipient_address?.trim())
        errors.recipient_address = "Morada para envio obrigatória";
    }
    // Data ideal: não pode ser anterior a hoje (regra do PDF)
    if (form.ideal_send_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ideal = new Date(form.ideal_send_date);
      if (ideal < today) errors.ideal_send_date = "A data não pode ser anterior a hoje";
    }
    if (form.how_found_fbr === "florista" && !form.how_found_fbr_other?.trim())
      errors.how_found_fbr_other = "Indica o nome da florista";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const goesToRecipient = form.delivery_recipient === "destinatario";
      const isDigital = form.delivery_format === "digital";
      const isPhysical = form.delivery_format === "fisico";
      const payload: VoucherInsert = {
        ...form,
        sender_name: form.sender_name.trim(),
        recipient_name: form.recipient_name.trim(),
        sender_email: form.sender_email?.trim() || null,
        sender_phone: form.sender_phone?.trim() || null,
        message: form.message?.trim() || null,
        comments: form.comments?.trim() || null,
        // shipping_cost só faz sentido se físico
        delivery_shipping_cost: isPhysical
          ? form.delivery_shipping_cost ?? VOUCHER_PHYSICAL_BASE_COST
          : null,
        delivery_channel: isDigital ? form.delivery_channel ?? null : null,
        // Contacto/morada do destinatário só fazem sentido se vai diretamente
        recipient_contact: goesToRecipient && isDigital
          ? form.recipient_contact?.trim() || null
          : null,
        recipient_address: goesToRecipient && isPhysical
          ? form.recipient_address?.trim() || null
          : null,
        // Data ideal só se vai para o destinatário
        ideal_send_date: goesToRecipient ? form.ideal_send_date || null : null,
      };
      await createVoucherAction(payload);
      setForm(INITIAL_FORM);
      onSuccess();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error && err.message ? err.message : "Erro desconhecido";
      setFieldErrors({ _root: `Erro ao guardar: ${msg}` });
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setForm(INITIAL_FORM);
    setFieldErrors({});
    onOpenChange(false);
  }

  const inputCls =
    "h-10 text-sm border-cream-200 bg-cream-50 focus:bg-surface text-cocoa-900 rounded-lg";

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-cream-50 p-0">
        {/* Hero do header */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-[#FFFCF7] via-white to-[#FAF3E8] border-b border-cream-200 px-6 py-5">
          <SheetHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-sm">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="font-['TanMemories'] text-2xl text-cocoa-900 leading-tight">
                  Novo vale-presente
                </SheetTitle>
                <SheetDescription className="text-cocoa-700 text-xs leading-snug mt-0.5">
                  Mínimo 300€. O código é gerado automaticamente.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {/* ── Remetente ─── */}
          <Section title="Dados do remetente" icon={<User className="h-3.5 w-3.5" />} accent="rose">
            <Field label="Nome *" error={fieldErrors.sender_name}>
              <Input
                value={form.sender_name}
                onChange={(e) => set("sender_name", e.target.value)}
                placeholder="Nome completo"
                className={`${inputCls} ${fieldErrors.sender_name ? "border-red-300" : ""}`}
              />
            </Field>

            <Field label="Como prefere ser contactado/a? *" error={fieldErrors.sender_contact_pref}>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceButton
                  active={form.sender_contact_pref === "whatsapp"}
                  onClick={() => set("sender_contact_pref", "whatsapp")}
                  icon={<MessageCircle className="h-4 w-4 text-green-600" />}
                  label="WhatsApp"
                  activeClass="bg-green-50 border-green-300 text-green-800"
                />
                <ChoiceButton
                  active={form.sender_contact_pref === "email"}
                  onClick={() => set("sender_contact_pref", "email")}
                  icon={<Mail className="h-4 w-4 text-blue-600" />}
                  label="Email"
                  activeClass="bg-blue-50 border-blue-300 text-blue-800"
                />
              </div>
            </Field>

            {form.sender_contact_pref === "whatsapp" && (
              <Field label="Número de telemóvel *" error={fieldErrors.sender_phone}>
                <Input
                  value={form.sender_phone ?? ""}
                  onChange={(e) => set("sender_phone", e.target.value)}
                  placeholder="+351 9XX XXX XXX"
                  className={`${inputCls} ${fieldErrors.sender_phone ? "border-red-300" : ""}`}
                />
              </Field>
            )}

            <Field label="E-mail de contacto *" error={fieldErrors.sender_email}>
              <Input
                type="email"
                value={form.sender_email ?? ""}
                onChange={(e) => set("sender_email", e.target.value)}
                placeholder="email@exemplo.pt"
                className={`${inputCls} ${fieldErrors.sender_email ? "border-red-300" : ""}`}
              />
              <p className="text-[11px] text-cocoa-500 mt-1">
                Pedimos um e-mail como contacto alternativo.
              </p>
            </Field>

            {form.sender_contact_pref === "email" && (
              <Field label="Telemóvel (opcional)">
                <Input
                  value={form.sender_phone ?? ""}
                  onChange={(e) => set("sender_phone", e.target.value)}
                  placeholder="+351 9XX XXX XXX"
                  className={inputCls}
                />
              </Field>
            )}
          </Section>

          {/* ── O vale ─── */}
          <Section title="O vale" icon={<Gift className="h-3.5 w-3.5" />} accent="amber">
            <Field label="Nome da(s) pessoa(s) a quem se destina *" error={fieldErrors.recipient_name}>
              <Input
                value={form.recipient_name}
                onChange={(e) => set("recipient_name", e.target.value)}
                placeholder="Ex: João e Maria"
                className={`${inputCls} ${fieldErrors.recipient_name ? "border-red-300" : ""}`}
              />
              <p className="text-[11px] text-cocoa-500 mt-1">
                Este nome será utilizado para personalizar o vale.
              </p>
            </Field>

            <Field label="Valor do vale (€) *" error={fieldErrors.amount}>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500" />
                <Input
                  type="number"
                  min={300}
                  step={10}
                  value={form.amount ?? 300}
                  onChange={(e) => set("amount", Number(e.target.value))}
                  className={`${inputCls} pl-9 ${fieldErrors.amount ? "border-red-300" : ""}`}
                />
              </div>
              <p className="text-[11px] text-cocoa-500 mt-1">
                Valor mínimo: 300€, correspondente ao quadro mais pequeno.
              </p>
            </Field>

            <Field label="Mensagem personalizada (opcional)">
              <Textarea
                value={form.message ?? ""}
                onChange={(e) => set("message", e.target.value)}
                placeholder="Mensagem que aparecerá no vale…"
                rows={3}
                maxLength={1000}
                className="text-sm border-cream-200 bg-cream-50 focus:bg-surface text-cocoa-900 rounded-lg resize-none"
              />
              <p className="text-[11px] text-cocoa-500 mt-1 text-right">
                {(form.message ?? "").length}/1000
              </p>
            </Field>
          </Section>

          {/* ── Entrega do vale ─── */}
          <Section title="Entrega" icon={<Send className="h-3.5 w-3.5" />} accent="emerald">
            <Field label="Quero que o vale seja entregue a *" error={fieldErrors.delivery_recipient}>
              <Select
                value={form.delivery_recipient ?? ""}
                onValueChange={(v) => set("delivery_recipient", v as VoucherInsert["delivery_recipient"])}
              >
                <SelectTrigger className={`${inputCls} ${fieldErrors.delivery_recipient ? "border-red-300" : ""}`}>
                  <SelectValue placeholder="Seleccionar..." labels={VOUCHER_DELIVERY_RECIPIENT_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(VOUCHER_DELIVERY_RECIPIENT_LABELS) as Array<keyof typeof VOUCHER_DELIVERY_RECIPIENT_LABELS>).map((k) => (
                    <SelectItem key={k} value={k}>{VOUCHER_DELIVERY_RECIPIENT_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Tipo de vale *" error={fieldErrors.delivery_format}>
              <Select
                value={form.delivery_format ?? ""}
                onValueChange={(v) => set("delivery_format", v as VoucherInsert["delivery_format"])}
              >
                <SelectTrigger className={`${inputCls} ${fieldErrors.delivery_format ? "border-red-300" : ""}`}>
                  <SelectValue placeholder="Seleccionar..." labels={VOUCHER_DELIVERY_FORMAT_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(VOUCHER_DELIVERY_FORMAT_LABELS) as Array<keyof typeof VOUCHER_DELIVERY_FORMAT_LABELS>).map((k) => (
                    <SelectItem key={k} value={k}>{VOUCHER_DELIVERY_FORMAT_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {form.delivery_format === "digital" && (
              <Field label="Por email ou WhatsApp? *" error={fieldErrors.delivery_channel}>
                <Select
                  value={form.delivery_channel ?? ""}
                  onValueChange={(v) => set("delivery_channel", v as VoucherInsert["delivery_channel"])}
                >
                  <SelectTrigger className={`${inputCls} ${fieldErrors.delivery_channel ? "border-red-300" : ""}`}>
                    <SelectValue placeholder="Seleccionar..." labels={VOUCHER_DELIVERY_CHANNEL_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(VOUCHER_DELIVERY_CHANNEL_LABELS) as Array<keyof typeof VOUCHER_DELIVERY_CHANNEL_LABELS>).map((k) => (
                      <SelectItem key={k} value={k}>{VOUCHER_DELIVERY_CHANNEL_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {/* Quando o vale é entregue diretamente ao destinatário, há campos extra. */}
            {form.delivery_recipient === "destinatario" && form.delivery_format === "digital" && (
              <Field
                label="E-mail ou WhatsApp do destinatário *"
                error={fieldErrors.recipient_contact}
              >
                <Input
                  value={form.recipient_contact ?? ""}
                  onChange={(e) => set("recipient_contact", e.target.value)}
                  placeholder={form.delivery_channel === "whatsapp" ? "+351 9XX XXX XXX" : "email@exemplo.pt"}
                  className={`${inputCls} ${fieldErrors.recipient_contact ? "border-red-300" : ""}`}
                />
                <p className="text-[11px] text-cocoa-500 mt-1">
                  Utilizado apenas para enviar o vale.
                </p>
              </Field>
            )}

            {form.delivery_recipient === "destinatario" && form.delivery_format === "fisico" && (
              <Field label="Morada para envio *" error={fieldErrors.recipient_address}>
                <Textarea
                  value={form.recipient_address ?? ""}
                  onChange={(e) => set("recipient_address", e.target.value)}
                  placeholder="Rua, número, código-postal, localidade…"
                  rows={2}
                  className={`text-sm border-cream-200 bg-cream-50 focus:bg-surface text-cocoa-900 rounded-lg resize-none ${fieldErrors.recipient_address ? "border-red-300" : ""}`}
                />
              </Field>
            )}

            {form.delivery_recipient === "destinatario" && (
              <Field label="Data ideal para envio (opcional)" error={fieldErrors.ideal_send_date}>
                <Input
                  type="date"
                  value={form.ideal_send_date ?? ""}
                  onChange={(e) => set("ideal_send_date", e.target.value || null)}
                  className={`${inputCls} ${fieldErrors.ideal_send_date ? "border-red-300" : ""}`}
                />
                <p className="text-[11px] text-cocoa-500 mt-1">
                  Deixe em branco se for indiferente.
                </p>
              </Field>
            )}

            {form.delivery_format === "fisico" && (
              <Field label="Custo de envio (€)">
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500" />
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.delivery_shipping_cost ?? VOUCHER_PHYSICAL_BASE_COST}
                    onChange={(e) => set("delivery_shipping_cost", Number(e.target.value))}
                    className={`${inputCls} pl-9`}
                  />
                </div>
                <p className="text-[11px] text-cocoa-500 mt-1">
                  Base {VOUCHER_PHYSICAL_BASE_COST}€ + portes adicionais.
                </p>
              </Field>
            )}
          </Section>

          {/* ── Origem ─── */}
          <Section title="Como conheceu a FBR" icon={<Compass className="h-3.5 w-3.5" />} accent="indigo">
            <Select
              value={form.how_found_fbr ?? ""}
              onValueChange={(v) => set("how_found_fbr", v as VoucherInsert["how_found_fbr"])}
            >
              <SelectTrigger
                className={`${inputCls} font-medium ${form.how_found_fbr ? HOW_FOUND_FBR_COLORS[form.how_found_fbr] : ""}`}
              >
                <SelectValue placeholder="Seleccionar..." labels={HOW_FOUND_FBR_LABELS} />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(HOW_FOUND_FBR_LABELS) as Array<keyof typeof HOW_FOUND_FBR_LABELS>).map((k) => (
                  <SelectItem key={k} value={k} className="my-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${HOW_FOUND_FBR_COLORS[k]}`}>
                      {HOW_FOUND_FBR_LABELS[k]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {form.how_found_fbr === "florista" && (
              <Field label="Que florista? *" error={fieldErrors.how_found_fbr_other}>
                <Input
                  value={form.how_found_fbr_other ?? ""}
                  onChange={(e) => set("how_found_fbr_other", e.target.value || null)}
                  placeholder="Nome da florista que recomendou…"
                  className={`${inputCls} ${fieldErrors.how_found_fbr_other ? "border-red-300" : ""}`}
                />
              </Field>
            )}

            {form.how_found_fbr === "outro" && (
              <Field label="Conte-nos como conheceu a Flores à Beira-Rio">
                <Input
                  value={form.how_found_fbr_other ?? ""}
                  onChange={(e) => set("how_found_fbr_other", e.target.value || null)}
                  placeholder="Como ouviu falar da FBR…"
                  className={inputCls}
                />
              </Field>
            )}
          </Section>

          {/* ── Comentários ─── */}
          <Section title="Comentários ou pedidos especiais (opcional)" icon={<StickyNote className="h-3.5 w-3.5" />} accent="slate">
            <Textarea
              value={form.comments ?? ""}
              onChange={(e) => set("comments", e.target.value)}
              placeholder="Pedidos especiais, informações relevantes…"
              rows={3}
              maxLength={1000}
              className="text-sm border-cream-200 bg-cream-50 focus:bg-surface text-cocoa-900 rounded-lg resize-none"
            />
            <p className="text-[11px] text-cocoa-500 mt-1">
              Caso necessite de receber o vale em menos de 3 dias úteis, informe-nos aqui para que possamos priorizar o seu pedido.
            </p>
          </Section>

          {fieldErrors._root && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {fieldErrors._root}
            </div>
          )}
        </form>

        {/* Footer fixo de acções */}
        <div className="sticky bottom-0 bg-surface/95 backdrop-blur border-t border-cream-200 px-6 py-3 flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-cream-200 text-cocoa-700 h-10"
            onClick={handleClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit as unknown as (e: React.MouseEvent) => void}
            className="flex-1 bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg h-10 gap-2"
            disabled={saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "A guardar…" : "Criar vale"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Helpers de layout ─────────────────────────────────────────

type Accent = "rose" | "amber" | "emerald" | "indigo" | "slate";

const ACCENT_STYLES: Record<Accent, { border: string; iconBg: string; iconColor: string }> = {
  rose:    { border: "border-l-rose-300",    iconBg: "bg-rose-50",    iconColor: "text-rose-500" },
  amber:   { border: "border-l-amber-300",   iconBg: "bg-amber-50",   iconColor: "text-amber-600" },
  emerald: { border: "border-l-emerald-300", iconBg: "bg-emerald-50", iconColor: "text-emerald-600" },
  indigo:  { border: "border-l-indigo-300",  iconBg: "bg-indigo-50",  iconColor: "text-indigo-600" },
  slate:   { border: "border-l-slate-300",   iconBg: "bg-slate-50",   iconColor: "text-slate-500" },
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
    <div className={`rounded-2xl border border-cream-200 bg-surface border-l-4 ${a.border} shadow-[0_1px_2px_rgba(61,43,31,0.04)] overflow-hidden`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-cream-100">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${a.iconBg} ${a.iconColor}`}>
          {icon}
        </span>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cocoa-700">
          {title}
        </p>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-cocoa-700">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  icon,
  label,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  activeClass: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 h-10 rounded-lg border transition-colors text-sm font-medium ${
        active ? activeClass : "border-cream-200 bg-cream-50 text-cocoa-700 hover:bg-surface"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
