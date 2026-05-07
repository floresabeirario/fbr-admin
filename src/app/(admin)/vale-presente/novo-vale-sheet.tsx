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
    if (!form.sender_contact_pref) errors.sender_contact_pref = "Selecciona o contacto preferido";
    if (!form.sender_email?.trim() && !form.sender_phone?.trim())
      errors.sender_email = "Email ou telemóvel obrigatório";
    if (!form.amount || form.amount < 300) errors.amount = "Mínimo 300€";
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
      const payload: VoucherInsert = {
        ...form,
        sender_name: form.sender_name.trim(),
        recipient_name: form.recipient_name.trim(),
        sender_email: form.sender_email?.trim() || null,
        sender_phone: form.sender_phone?.trim() || null,
        message: form.message?.trim() || null,
        comments: form.comments?.trim() || null,
        // shipping_cost só faz sentido se físico
        delivery_shipping_cost:
          form.delivery_format === "fisico"
            ? form.delivery_shipping_cost ?? VOUCHER_PHYSICAL_BASE_COST
            : null,
        delivery_channel:
          form.delivery_format === "digital" ? form.delivery_channel ?? null : null,
      };
      await createVoucherAction(payload);
      setForm(INITIAL_FORM);
      onSuccess();
    } catch (err) {
      console.error(err);
      setFieldErrors({ _root: "Erro ao guardar. Tenta novamente." });
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
    "h-10 text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F] rounded-lg";

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-[#FAF8F5] p-0">
        {/* Hero do header */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-[#FFFCF7] via-white to-[#FAF3E8] border-b border-[#E8E0D5] px-6 py-5">
          <SheetHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-sm">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="font-['TanMemories'] text-2xl text-[#3D2B1F] leading-tight">
                  Novo vale-presente
                </SheetTitle>
                <SheetDescription className="text-[#8B7355] text-xs leading-snug mt-0.5">
                  Mínimo 300€. O código é gerado automaticamente.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {/* ── Remetente ─── */}
          <Section title="Quem oferece (remetente)" icon={<User className="h-3.5 w-3.5" />} accent="rose">
            <Field label="Nome *" error={fieldErrors.sender_name}>
              <Input
                value={form.sender_name}
                onChange={(e) => set("sender_name", e.target.value)}
                placeholder="Nome completo"
                className={`${inputCls} ${fieldErrors.sender_name ? "border-red-300" : ""}`}
              />
            </Field>

            <Field label="Contacto preferido *" error={fieldErrors.sender_contact_pref}>
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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" error={fieldErrors.sender_email}>
                <Input
                  type="email"
                  value={form.sender_email ?? ""}
                  onChange={(e) => set("sender_email", e.target.value)}
                  placeholder="email@exemplo.pt"
                  className={`${inputCls} ${fieldErrors.sender_email ? "border-red-300" : ""}`}
                />
              </Field>
              <Field label="Telemóvel">
                <Input
                  value={form.sender_phone ?? ""}
                  onChange={(e) => set("sender_phone", e.target.value)}
                  placeholder="+351 9XX XXX XXX"
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>

          {/* ── O vale ─── */}
          <Section title="O vale" icon={<Gift className="h-3.5 w-3.5" />} accent="amber">
            <Field label="Nome do destinatário *" error={fieldErrors.recipient_name}>
              <Input
                value={form.recipient_name}
                onChange={(e) => set("recipient_name", e.target.value)}
                placeholder="Para quem é o vale"
                className={`${inputCls} ${fieldErrors.recipient_name ? "border-red-300" : ""}`}
              />
            </Field>

            <Field label="Valor (€) *" error={fieldErrors.amount}>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B8A99A]" />
                <Input
                  type="number"
                  min={300}
                  step={10}
                  value={form.amount ?? 300}
                  onChange={(e) => set("amount", Number(e.target.value))}
                  className={`${inputCls} pl-9 ${fieldErrors.amount ? "border-red-300" : ""}`}
                />
              </div>
              <p className="text-[11px] text-[#B8A99A] mt-1">Mínimo 300€.</p>
            </Field>

            <Field label="Mensagem personalizada">
              <Textarea
                value={form.message ?? ""}
                onChange={(e) => set("message", e.target.value)}
                placeholder="Mensagem que aparecerá no vale..."
                rows={3}
                className="text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F] rounded-lg resize-none"
              />
            </Field>
          </Section>

          {/* ── Entrega do vale ─── */}
          <Section title="Entrega do vale" icon={<Send className="h-3.5 w-3.5" />} accent="emerald">
            <Field label="Para quem entregar?">
              <Select
                value={form.delivery_recipient ?? ""}
                onValueChange={(v) => set("delivery_recipient", v as VoucherInsert["delivery_recipient"])}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Seleccionar..." labels={VOUCHER_DELIVERY_RECIPIENT_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(VOUCHER_DELIVERY_RECIPIENT_LABELS) as Array<keyof typeof VOUCHER_DELIVERY_RECIPIENT_LABELS>).map((k) => (
                    <SelectItem key={k} value={k}>{VOUCHER_DELIVERY_RECIPIENT_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Formato">
              <Select
                value={form.delivery_format ?? ""}
                onValueChange={(v) => set("delivery_format", v as VoucherInsert["delivery_format"])}
              >
                <SelectTrigger className={inputCls}>
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
              <Field label="Canal digital">
                <Select
                  value={form.delivery_channel ?? ""}
                  onValueChange={(v) => set("delivery_channel", v as VoucherInsert["delivery_channel"])}
                >
                  <SelectTrigger className={inputCls}>
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

            {form.delivery_format === "fisico" && (
              <Field label="Custo de envio (€)">
                <div className="relative">
                  <Euro className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B8A99A]" />
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.delivery_shipping_cost ?? VOUCHER_PHYSICAL_BASE_COST}
                    onChange={(e) => set("delivery_shipping_cost", Number(e.target.value))}
                    className={`${inputCls} pl-9`}
                  />
                </div>
                <p className="text-[11px] text-[#B8A99A] mt-1">
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
              <Field label='Especifique "Outro"'>
                <Input
                  value={form.how_found_fbr_other ?? ""}
                  onChange={(e) => set("how_found_fbr_other", e.target.value || null)}
                  placeholder="Como ouviu falar da FBR..."
                  className={inputCls}
                />
              </Field>
            )}
          </Section>

          {/* ── Comentários ─── */}
          <Section title="Comentários" icon={<StickyNote className="h-3.5 w-3.5" />} accent="slate">
            <Textarea
              value={form.comments ?? ""}
              onChange={(e) => set("comments", e.target.value)}
              placeholder="Pedidos especiais, informações relevantes..."
              rows={3}
              className="text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F] rounded-lg resize-none"
            />
          </Section>

          {fieldErrors._root && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {fieldErrors._root}
            </div>
          )}
        </form>

        {/* Footer fixo de acções */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-[#E8E0D5] px-6 py-3 flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-[#E8E0D5] text-[#8B7355] h-10"
            onClick={handleClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit as unknown as (e: React.MouseEvent) => void}
            className="flex-1 bg-[#3D2B1F] hover:bg-[#2C1F15] text-white h-10 gap-2"
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
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-[#8B7355]">{label}</Label>
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
        active ? activeClass : "border-[#E8E0D5] bg-[#FAF8F5] text-[#8B7355] hover:bg-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
