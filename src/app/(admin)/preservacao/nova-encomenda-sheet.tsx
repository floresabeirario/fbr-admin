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
import { createOrderAction } from "./actions";
import {
  type OrderInsert,
  CONTACT_PREFERENCE_LABELS,
  EVENT_TYPE_LABELS,
  FLOWER_DELIVERY_METHOD_LABELS,
  FRAME_DELIVERY_METHOD_LABELS,
  FRAME_SIZE_LABELS,
  FRAME_BACKGROUND_LABELS,
  HOW_FOUND_FBR_LABELS,
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

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-white">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-[#3D2B1F]">Nova Encomenda</SheetTitle>
          <SheetDescription className="text-[#8B7355]">
            Preenche os dados essenciais. Podes completar o resto no workbench.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Dados do cliente ─── */}
          <Section title="Dados do cliente">
            <Field label="Nome na encomenda *" error={fieldErrors.client_name}>
              <Input
                value={form.client_name}
                onChange={(e) => set("client_name", e.target.value)}
                placeholder="Nome completo"
                className={inputClass(fieldErrors.client_name)}
              />
            </Field>

            <Field label="Contacto preferido *" error={fieldErrors.contact_preference}>
              <Select
                value={form.contact_preference ?? ""}
                onValueChange={(v) => set("contact_preference", v as "whatsapp" | "email")}
              >
                <SelectTrigger className={inputClass(fieldErrors.contact_preference)}>
                  <SelectValue placeholder="Seleccionar..." labels={CONTACT_PREFERENCE_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" error={fieldErrors.email}>
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="email@exemplo.pt"
                  className={inputClass(fieldErrors.email)}
                />
              </Field>
              <Field label="Telemóvel">
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="+351 9XX XXX XXX"
                />
              </Field>
            </div>
          </Section>

          {/* ── Dados do evento ─── */}
          <Section title="Dados do evento">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo de evento">
                <Select
                  value={form.event_type ?? ""}
                  onValueChange={(v) => set("event_type", v as OrderInsert["event_type"])}
                >
                  <SelectTrigger>
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
                />
              </Field>
            </div>

            {form.event_type === "casamento" && (
              <Field label="Nome dos noivos">
                <Input
                  value={form.couple_names ?? ""}
                  onChange={(e) => set("couple_names", e.target.value)}
                  placeholder="Ana & João"
                />
              </Field>
            )}

            <Field label="Localização do evento">
              <Input
                value={form.event_location ?? ""}
                onChange={(e) => set("event_location", e.target.value)}
                placeholder="Quinta / Igreja / Cidade"
              />
            </Field>
          </Section>

          {/* ── Flores e quadro ─── */}
          <Section title="Flores e quadro">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Envio das flores">
                <Select
                  value={form.flower_delivery_method ?? ""}
                  onValueChange={(v) =>
                    set("flower_delivery_method", v as OrderInsert["flower_delivery_method"])
                  }
                >
                  <SelectTrigger>
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
                  <SelectTrigger>
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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tamanho da moldura">
                <Select
                  value={form.frame_size ?? ""}
                  onValueChange={(v) => set("frame_size", v as OrderInsert["frame_size"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." labels={FRAME_SIZE_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30x40">30×40</SelectItem>
                    <SelectItem value="40x50">40×50</SelectItem>
                    <SelectItem value="50x70">50×70</SelectItem>
                    <SelectItem value="voces_a_escolher">Vocês a escolher</SelectItem>
                    <SelectItem value="nao_sei">Não sei</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fundo do quadro">
                <Select
                  value={form.frame_background ?? ""}
                  onValueChange={(v) => set("frame_background", v as OrderInsert["frame_background"])}
                >
                  <SelectTrigger>
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
              />
            </Field>
          </Section>

          {/* ── Origem ─── */}
          <Section title="Como conheceu a FBR">
            <Select
              value={form.how_found_fbr ?? ""}
              onValueChange={(v) => set("how_found_fbr", v as OrderInsert["how_found_fbr"])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." labels={HOW_FOUND_FBR_LABELS} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="casamentos_pt">casamentos.pt</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="vale_presente">Vale-Presente</SelectItem>
                <SelectItem value="florista">Florista</SelectItem>
                <SelectItem value="recomendacao">Recomendação</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>

            {form.how_found_fbr === "vale_presente" && (
              <Field label="Código vale-presente">
                <Input
                  value={form.gift_voucher_code ?? ""}
                  onChange={(e) => set("gift_voucher_code", e.target.value || null)}
                  placeholder="Código de 6 dígitos"
                />
              </Field>
            )}

            {form.how_found_fbr === "florista" && (
              <Field label="Que florista? *" error={fieldErrors.how_found_fbr_other}>
                <Input
                  value={form.how_found_fbr_other ?? ""}
                  onChange={(e) => set("how_found_fbr_other", e.target.value || null)}
                  placeholder="Nome da florista que recomendou…"
                  className={inputClass(fieldErrors.how_found_fbr_other)}
                />
              </Field>
            )}

            {form.how_found_fbr === "outro" && (
              <Field label='Especifique "Outro"'>
                <Input
                  value={form.how_found_fbr_other ?? ""}
                  onChange={(e) => set("how_found_fbr_other", e.target.value || null)}
                  placeholder="Como ouviu falar da FBR..."
                />
              </Field>
            )}
          </Section>

          {/* ── Notas ─── */}
          <Section title="Notas adicionais">
            <Textarea
              value={form.additional_notes ?? ""}
              onChange={(e) => set("additional_notes", e.target.value)}
              placeholder="Pedidos especiais, informações relevantes..."
              rows={3}
            />
          </Section>

          {fieldErrors._root && (
            <p className="text-sm text-red-600">{fieldErrors._root}</p>
          )}

          {/* Acções */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-[#E8E0D5] text-[#8B7355]"
              onClick={handleClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-[#3D2B1F] hover:bg-[#2C1F15] text-white"
              disabled={saving}
            >
              {saving ? "A guardar..." : "Criar encomenda"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ── Helpers de layout do formulário ──────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#8B7355]">{title}</p>
      {children}
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
    <div className="space-y-1">
      <Label className="text-xs text-[#3D2B1F]">{label}</Label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function inputClass(error?: string): string {
  return error ? "border-red-300 focus:border-red-400" : "";
}
