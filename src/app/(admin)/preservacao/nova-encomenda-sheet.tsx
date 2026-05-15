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
  CalendarHeart,
  Flower2,
  Compass,
  StickyNote,
  Sparkles,
  Loader2,
  Mail,
  MessageCircle,
} from "lucide-react";
import { createOrderAction } from "./actions";
import {
  type OrderInsert,
  EVENT_TYPE_LABELS,
  FLOWER_DELIVERY_METHOD_LABELS,
  FRAME_DELIVERY_METHOD_LABELS,
  FRAME_SIZE_LABELS,
  FRAME_SIZE_COLORS,
  FRAME_BACKGROUND_LABELS,
  HOW_FOUND_FBR_LABELS,
  HOW_FOUND_FBR_COLORS,
} from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const INITIAL_FORM: OrderInsert = {
  client_name: "",
  contact_preference: undefined,
  email: "",
  phone: "",
  event_date: undefined,
  event_type: undefined,
  couple_names: "",
  event_location: "",
  flower_delivery_method: undefined,
  flower_type: "",
  frame_delivery_method: undefined,
  frame_background: undefined,
  frame_size: undefined,
  how_found_fbr: undefined,
  additional_notes: "",
  status: "entrega_flores_agendar",
  payment_status: "100_por_pagar",
};

export default function NovaEncomendaSheet({ open, onOpenChange, onSuccess }: Props) {
  const [form, setForm] = useState<OrderInsert>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function set<K extends keyof OrderInsert>(key: K, value: OrderInsert[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => ({ ...prev, [key]: "" }));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.client_name?.trim()) errors.client_name = "Nome obrigatório";
    if (!form.contact_preference) errors.contact_preference = "Selecciona o contacto preferido";
    if (!form.email?.trim() && !form.phone?.trim())
      errors.email = "Email ou telemóvel obrigatório";
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
      const payload: OrderInsert = {
        ...form,
        client_name: form.client_name.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        couple_names: form.event_type === "casamento" ? form.couple_names?.trim() || null : null,
        event_date: form.event_date || null,
        event_location: form.event_location?.trim() || null,
        flower_type: form.flower_type?.trim() || null,
        additional_notes: form.additional_notes?.trim() || null,
      };
      await createOrderAction(payload);
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

  const inputCls = "h-10 text-sm border-cream-200 bg-cream-50 focus:bg-surface text-cocoa-900 rounded-lg";

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-cream-50 p-0">
        {/* Hero do header */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-[#FFFCF7] via-white to-[#FAF3E8] border-b border-cream-200 px-6 py-5">
          <SheetHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-amber-500 text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="font-['TanMemories'] text-2xl text-cocoa-900 leading-tight">
                  Nova encomenda
                </SheetTitle>
                <SheetDescription className="text-cocoa-700 text-xs leading-snug mt-0.5">
                  Dados essenciais agora — completa o resto no workbench depois.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {/* ── Dados do cliente ─── */}
          <Section title="Dados do cliente" icon={<User className="h-3.5 w-3.5" />} accent="rose">
            <Field label="Nome na encomenda *" error={fieldErrors.client_name}>
              <Input
                value={form.client_name}
                onChange={(e) => set("client_name", e.target.value)}
                placeholder="Nome completo"
                className={`${inputCls} ${fieldErrors.client_name ? "border-red-300 focus:border-red-400" : ""}`}
              />
            </Field>

            <Field label="Contacto preferido *" error={fieldErrors.contact_preference}>
              <div className="grid grid-cols-2 gap-2">
                <ChoiceButton
                  active={form.contact_preference === "whatsapp"}
                  onClick={() => set("contact_preference", "whatsapp")}
                  icon={<MessageCircle className="h-4 w-4 text-green-600" />}
                  label="WhatsApp"
                  activeClass="bg-green-50 border-green-300 text-green-800"
                />
                <ChoiceButton
                  active={form.contact_preference === "email"}
                  onClick={() => set("contact_preference", "email")}
                  icon={<Mail className="h-4 w-4 text-blue-600" />}
                  label="Email"
                  activeClass="bg-blue-50 border-blue-300 text-blue-800"
                />
              </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Email" error={fieldErrors.email}>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500" />
                  <Input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="email@exemplo.pt"
                    className={`${inputCls} pl-9 ${fieldErrors.email ? "border-red-300 focus:border-red-400" : ""}`}
                  />
                </div>
              </Field>
              <Field label="Telemóvel">
                <div className="relative">
                  <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500" />
                  <Input
                    value={form.phone ?? ""}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+351 9XX XXX XXX"
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </Field>
            </div>
          </Section>

          {/* ── Dados do evento ─── */}
          <Section title="Dados do evento" icon={<CalendarHeart className="h-3.5 w-3.5" />} accent="amber">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Tipo de evento">
                <Select
                  value={form.event_type ?? ""}
                  onValueChange={(v) => set("event_type", v as OrderInsert["event_type"])}
                >
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Seleccionar..." labels={EVENT_TYPE_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casamento">Casamento</SelectItem>
                    <SelectItem value="batizado">Batizado</SelectItem>
                    <SelectItem value="funeral">Funeral</SelectItem>
                    <SelectItem value="pedido_casamento">Pedido de Casamento</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data do evento">
                <Input
                  type="date"
                  value={form.event_date ?? ""}
                  onChange={(e) => set("event_date", e.target.value || undefined)}
                  className={inputCls}
                />
              </Field>
            </div>

            {form.event_type === "casamento" && (
              <Field label="Nome dos noivos">
                <Input
                  value={form.couple_names ?? ""}
                  onChange={(e) => set("couple_names", e.target.value)}
                  placeholder="Ana & João"
                  className={inputCls}
                />
              </Field>
            )}

            <Field label="Localização do evento">
              <Input
                value={form.event_location ?? ""}
                onChange={(e) => set("event_location", e.target.value)}
                placeholder="Quinta / Igreja / Cidade"
                className={inputCls}
              />
            </Field>
          </Section>

          {/* ── Flores e quadro ─── */}
          <Section title="Flores e quadro" icon={<Flower2 className="h-3.5 w-3.5" />} accent="emerald">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Envio das flores">
                <Select
                  value={form.flower_delivery_method ?? ""}
                  onValueChange={(v) =>
                    set("flower_delivery_method", v as OrderInsert["flower_delivery_method"])
                  }
                >
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Seleccionar..." labels={FLOWER_DELIVERY_METHOD_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maos">Em mãos</SelectItem>
                    <SelectItem value="ctt">CTT</SelectItem>
                    <SelectItem value="recolha_evento">Recolha no evento</SelectItem>
                    <SelectItem value="nao_sei">Não sei</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Receção do quadro">
                <Select
                  value={form.frame_delivery_method ?? ""}
                  onValueChange={(v) =>
                    set("frame_delivery_method", v as OrderInsert["frame_delivery_method"])
                  }
                >
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Seleccionar..." labels={FRAME_DELIVERY_METHOD_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maos">Em mãos</SelectItem>
                    <SelectItem value="ctt">CTT</SelectItem>
                    <SelectItem value="nao_sei">Não sei</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Tamanho da moldura">
                <Select
                  value={form.frame_size ?? ""}
                  onValueChange={(v) => set("frame_size", v as OrderInsert["frame_size"])}
                >
                  <SelectTrigger
                    className={`${inputCls} font-medium ${form.frame_size ? FRAME_SIZE_COLORS[form.frame_size] : ""}`}
                  >
                    <SelectValue placeholder="Seleccionar..." labels={FRAME_SIZE_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FRAME_SIZE_LABELS) as Array<keyof typeof FRAME_SIZE_LABELS>).map((k) => (
                      <SelectItem key={k} value={k} className="my-0.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${FRAME_SIZE_COLORS[k]}`}>
                          {FRAME_SIZE_LABELS[k]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fundo do quadro">
                <Select
                  value={form.frame_background ?? ""}
                  onValueChange={(v) => set("frame_background", v as OrderInsert["frame_background"])}
                >
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Seleccionar..." labels={FRAME_BACKGROUND_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transparente">Transparente</SelectItem>
                    <SelectItem value="preto">Preto</SelectItem>
                    <SelectItem value="branco">Branco</SelectItem>
                    <SelectItem value="fotografia">Fotografia</SelectItem>
                    <SelectItem value="cor">Cor</SelectItem>
                    <SelectItem value="voces_a_escolher">Vocês a escolher</SelectItem>
                    <SelectItem value="nao_sei">Não sei</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Tipo de flores">
              <Input
                value={form.flower_type ?? ""}
                onChange={(e) => set("flower_type", e.target.value)}
                placeholder="Rosas, peónias, silvestres..."
                className={inputCls}
              />
            </Field>
          </Section>

          {/* ── Origem ─── */}
          <Section title="Como conheceu a FBR" icon={<Compass className="h-3.5 w-3.5" />} accent="indigo">
            <Select
              value={form.how_found_fbr ?? ""}
              onValueChange={(v) => set("how_found_fbr", v as OrderInsert["how_found_fbr"])}
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

            {form.how_found_fbr === "vale_presente" && (
              <Field label="Código vale-presente">
                <Input
                  value={form.gift_voucher_code ?? ""}
                  onChange={(e) => set("gift_voucher_code", e.target.value || null)}
                  placeholder="Código de 6 dígitos"
                  className={inputCls}
                />
              </Field>
            )}

            {form.how_found_fbr === "florista" && (
              <Field label="Que florista? *" error={fieldErrors.how_found_fbr_other}>
                <Input
                  value={form.how_found_fbr_other ?? ""}
                  onChange={(e) => set("how_found_fbr_other", e.target.value || null)}
                  placeholder="Nome da florista que recomendou…"
                  className={`${inputCls} ${fieldErrors.how_found_fbr_other ? "border-red-300 focus:border-red-400" : ""}`}
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

          {/* ── Notas ─── */}
          <Section title="Notas adicionais" icon={<StickyNote className="h-3.5 w-3.5" />} accent="slate">
            <Textarea
              value={form.additional_notes ?? ""}
              onChange={(e) => set("additional_notes", e.target.value)}
              placeholder="Pedidos especiais, informações relevantes..."
              rows={3}
              className="text-sm border-cream-200 bg-cream-50 focus:bg-surface text-cocoa-900 rounded-lg resize-none"
            />
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
            {saving ? "A guardar…" : "Criar encomenda"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Helpers de layout do formulário ──────────────────────────

type Accent = "rose" | "amber" | "emerald" | "indigo" | "slate";

const ACCENT_STYLES: Record<Accent, { border: string; iconBg: string; iconColor: string }> = {
  rose:    { border: "border-l-rose-300 dark:border-l-rose-700",       iconBg: "bg-rose-50 dark:bg-rose-950/40",       iconColor: "text-rose-500 dark:text-rose-400" },
  amber:   { border: "border-l-amber-300 dark:border-l-amber-700",     iconBg: "bg-amber-50 dark:bg-amber-950/40",     iconColor: "text-amber-600 dark:text-amber-400" },
  emerald: { border: "border-l-emerald-300 dark:border-l-emerald-700", iconBg: "bg-emerald-50 dark:bg-emerald-950/40", iconColor: "text-emerald-600 dark:text-emerald-400" },
  indigo:  { border: "border-l-indigo-300 dark:border-l-indigo-700",   iconBg: "bg-indigo-50 dark:bg-indigo-950/40",   iconColor: "text-indigo-600 dark:text-indigo-400" },
  slate:   { border: "border-l-slate-300 dark:border-l-slate-600",     iconBg: "bg-slate-50 dark:bg-slate-900/40",     iconColor: "text-slate-500 dark:text-slate-400" },
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
      {error && <p className="text-xs text-red-600">{error}</p>}
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
      className={`flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-medium transition-colors ${
        active
          ? activeClass
          : "border-cream-200 bg-cream-50 text-cocoa-700 hover:bg-surface hover:text-cocoa-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
