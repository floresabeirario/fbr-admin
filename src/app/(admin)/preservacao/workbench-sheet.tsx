"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Check, ExternalLink, Copy } from "lucide-react";
import { updateOrderAction } from "./actions";
import type { Order, OrderUpdate } from "@/types/database";
import {
  STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
} from "@/types/database";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";

// ── Helpers ────────────────────────────────────────────────────

function toDateInput(val: string | null): string {
  if (!val) return "";
  try { return format(parseISO(val), "yyyy-MM-dd"); } catch { return ""; }
}

function fromDateInput(val: string): string | null {
  return val || null;
}

const STATUS_COLORS: Record<string, string> = {
  entrega_flores_agendar: "bg-amber-50 text-amber-700 border-amber-200",
  entrega_agendada:       "bg-blue-50 text-blue-700 border-blue-200",
  flores_enviadas:        "bg-blue-50 text-blue-700 border-blue-200",
  flores_recebidas:       "bg-blue-50 text-blue-700 border-blue-200",
  flores_na_prensa:       "bg-purple-50 text-purple-700 border-purple-200",
  reconstrucao_botanica:  "bg-purple-50 text-purple-700 border-purple-200",
  a_compor_design:        "bg-purple-50 text-purple-700 border-purple-200",
  a_aguardar_aprovacao:   "bg-purple-50 text-purple-700 border-purple-200",
  a_ser_emoldurado:       "bg-orange-50 text-orange-700 border-orange-200",
  emoldurado:             "bg-orange-50 text-orange-700 border-orange-200",
  a_ser_fotografado:      "bg-orange-50 text-orange-700 border-orange-200",
  quadro_pronto:          "bg-orange-50 text-orange-700 border-orange-200",
  quadro_enviado:         "bg-orange-50 text-orange-700 border-orange-200",
  quadro_recebido:        "bg-green-50 text-green-700 border-green-200",
  cancelado:              "bg-gray-50 text-gray-500 border-gray-200",
};

// ── Componentes auxiliares ─────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C4A882]">{title}</p>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-[#8B7355]">{label}</Label>
      {children}
    </div>
  );
}

function FieldFull({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="col-span-2 space-y-1">
      <Label className="text-xs text-[#8B7355]">{label}</Label>
      {children}
    </div>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className="border-[#C4A882] data-[state=checked]:bg-[#3D2B1F] data-[state=checked]:border-[#3D2B1F]"
      />
      <Label className="text-xs text-[#3D2B1F] cursor-pointer">{label}</Label>
    </div>
  );
}

const inputCls = "h-8 text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F]";

// ── Componente principal ───────────────────────────────────────

interface Props {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WorkbenchSheet({ order, open, onOpenChange }: Props) {
  const router = useRouter();
  const [local, setLocal] = useState<Order | null>(order);
  const pendingRef = useRef<OrderUpdate>({});
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (order) {
      setLocal(order);
      pendingRef.current = {};
      setSaveState("idle");
    }
  }, [order]);

  const flush = useCallback(async (overrides?: OrderUpdate) => {
    if (!order) return;
    const updates = { ...pendingRef.current, ...overrides };
    if (Object.keys(updates).length === 0) return;
    pendingRef.current = {};
    clearTimeout(timerRef.current);
    setSaveState("saving");
    try {
      const updated = await updateOrderAction(order.id, updates);
      setLocal(updated);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
      router.refresh();
    } catch {
      setSaveState("idle");
    }
  }, [order, router]);

  function update<K extends keyof OrderUpdate>(key: K, value: OrderUpdate[K]) {
    setLocal((prev) => (prev ? { ...prev, [key]: value } : prev));
    pendingRef.current = { ...pendingRef.current, [key]: value };
    setSaveState("idle");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flush(), 900);
  }

  function handleClose(open: boolean) {
    if (!open) flush();
    onOpenChange(open);
  }

  if (!local) return null;

  const isWedding = local.event_type === "casamento";
  const createdAt = local.created_at
    ? format(parseISO(local.created_at), "dd/MM/yyyy HH:mm", { locale: pt })
    : "—";

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="flex flex-col w-full sm:max-w-2xl p-0 bg-[#FDFAF7]"
      >
        {/* ── Cabeçalho ──────────────────────────────────────── */}
        <div className="shrink-0 border-b border-[#E8E0D5] bg-white px-6 py-4">
          <SheetHeader className="mb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SheetTitle className="text-base font-semibold text-[#3D2B1F]">
                  {local.client_name}
                </SheetTitle>
                <p className="mt-0.5 font-mono text-[10px] text-[#B8A99A]">
                  #{local.order_id}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {saveState === "saving" && (
                  <span className="flex items-center gap-1 text-[#B8A99A]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    A guardar…
                  </span>
                )}
                {saveState === "saved" && (
                  <span className="flex items-center gap-1 text-green-600">
                    <Check className="h-3 w-3" />
                    Guardado
                  </span>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Estado (destaque) */}
          <div className="space-y-1">
            <Label className="text-xs text-[#8B7355]">Estado</Label>
            <Select
              value={local.status}
              onValueChange={(v) => update("status", v as Order["status"])}
            >
              <SelectTrigger
                className={`h-8 text-xs font-medium border ${STATUS_COLORS[local.status] ?? ""}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <CheckField
              label="Contactada"
              checked={local.contacted}
              onChange={(v) => update("contacted", v)}
            />
            <span className="text-xs text-[#B8A99A]">Criada {createdAt}</span>
          </div>
        </div>

        {/* ── Corpo scrollável ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Dados do cliente */}
          <Section title="Dados do cliente">
            <Row>
              <Field label="Nome na encomenda">
                <Input
                  className={inputCls}
                  value={local.client_name}
                  onChange={(e) => update("client_name", e.target.value)}
                />
              </Field>
              <Field label="Contacto preferido">
                <Select
                  value={local.contact_preference ?? ""}
                  onValueChange={(v) => update("contact_preference", v as Order["contact_preference"])}
                >
                  <SelectTrigger className={inputCls}><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Row>
            <Row>
              <Field label="Email">
                <Input className={inputCls} type="email" value={local.email ?? ""} onChange={(e) => update("email", e.target.value || null)} />
              </Field>
              <Field label="Telemóvel">
                <Input className={inputCls} value={local.phone ?? ""} onChange={(e) => update("phone", e.target.value || null)} />
              </Field>
            </Row>
          </Section>

          <Separator className="bg-[#F0EAE0]" />

          {/* Dados do evento */}
          <Section title="Dados do evento">
            <Row>
              <Field label="Tipo de evento">
                <Select
                  value={local.event_type ?? ""}
                  onValueChange={(v) => update("event_type", v as Order["event_type"])}
                >
                  <SelectTrigger className={inputCls}><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(EVENT_TYPE_LABELS) as Array<keyof typeof EVENT_TYPE_LABELS>).map((t) => (
                      <SelectItem key={t} value={t}>{EVENT_TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data do evento">
                <Input
                  className={inputCls}
                  type="date"
                  value={toDateInput(local.event_date)}
                  onChange={(e) => update("event_date", fromDateInput(e.target.value))}
                />
              </Field>
            </Row>
            {isWedding && (
              <Field label="Nome dos noivos">
                <Input className={inputCls} value={local.couple_names ?? ""} onChange={(e) => update("couple_names", e.target.value || null)} />
              </Field>
            )}
            <Field label="Localização do evento">
              <Input className={inputCls} value={local.event_location ?? ""} onChange={(e) => update("event_location", e.target.value || null)} />
            </Field>
          </Section>

          <Separator className="bg-[#F0EAE0]" />

          {/* Flores e quadro */}
          <Section title="Flores e quadro">
            <Row>
              <Field label="Envio das flores">
                <Select value={local.flower_delivery_method ?? ""} onValueChange={(v) => update("flower_delivery_method", v as Order["flower_delivery_method"])}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maos">Em mãos</SelectItem>
                    <SelectItem value="ctt">CTT</SelectItem>
                    <SelectItem value="recolha_evento">Recolha no evento</SelectItem>
                    <SelectItem value="nao_sei">Não sei</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Receção do quadro">
                <Select value={local.frame_delivery_method ?? ""} onValueChange={(v) => update("frame_delivery_method", v as Order["frame_delivery_method"])}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maos">Em mãos</SelectItem>
                    <SelectItem value="ctt">CTT</SelectItem>
                    <SelectItem value="nao_sei">Não sei</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Row>
            <Row>
              <Field label="Tamanho da moldura">
                <Select value={local.frame_size ?? ""} onValueChange={(v) => update("frame_size", v as Order["frame_size"])}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="—" /></SelectTrigger>
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
                <Select value={local.frame_background ?? ""} onValueChange={(v) => update("frame_background", v as Order["frame_background"])}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="—" /></SelectTrigger>
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
            </Row>
            <Field label="Tipo de flores">
              <Input className={inputCls} value={local.flower_type ?? ""} onChange={(e) => update("flower_type", e.target.value || null)} />
            </Field>
          </Section>

          <Separator className="bg-[#F0EAE0]" />

          {/* Finanças */}
          <Section title="Finanças">
            <Row>
              <Field label="Orçamento (€)">
                <Input
                  className={inputCls}
                  type="number"
                  min={0}
                  step={0.01}
                  value={local.budget ?? ""}
                  onChange={(e) => update("budget", e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field label="Estado do pagamento">
                <Select value={local.payment_status} onValueChange={(v) => update("payment_status", v as Order["payment_status"])}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PAYMENT_STATUS_LABELS) as Array<keyof typeof PAYMENT_STATUS_LABELS>).map((s) => (
                      <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </Row>
            <Row>
              <Field label="NIF">
                <Input className={inputCls} value={local.nif ?? ""} onChange={(e) => update("nif", e.target.value || null)} />
              </Field>
              <div className="flex items-end pb-1">
                <CheckField label="Precisa de fatura" checked={local.needs_invoice} onChange={(v) => update("needs_invoice", v)} />
              </div>
            </Row>
            <Row>
              <Field label="Custo envio flores (€)">
                <Input className={inputCls} type="number" min={0} step={0.01} value={local.flower_shipping_cost ?? ""} onChange={(e) => update("flower_shipping_cost", e.target.value ? Number(e.target.value) : null)} />
              </Field>
              <div className="flex items-end pb-1">
                <CheckField label="Envio flores pago" checked={local.flower_shipping_paid} onChange={(v) => update("flower_shipping_paid", v)} />
              </div>
            </Row>
            <Row>
              <Field label="Custo envio quadro (€)">
                <Input className={inputCls} type="number" min={0} step={0.01} value={local.frame_shipping_cost ?? ""} onChange={(e) => update("frame_shipping_cost", e.target.value ? Number(e.target.value) : null)} />
              </Field>
              <div className="flex items-end pb-1">
                <CheckField label="Envio quadro pago" checked={local.frame_shipping_paid} onChange={(v) => update("frame_shipping_paid", v)} />
              </div>
            </Row>
          </Section>

          <Separator className="bg-[#F0EAE0]" />

          {/* Parceria */}
          <Section title="Parceria">
            <Row>
              <Field label="Comissão (€)">
                <Input className={inputCls} type="number" min={0} step={0.01} value={local.partner_commission ?? ""} onChange={(e) => update("partner_commission", e.target.value ? Number(e.target.value) : null)} />
              </Field>
              <Field label="Estado da comissão">
                <Select value={local.partner_commission_status} onValueChange={(v) => update("partner_commission_status", v as Order["partner_commission_status"])}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="na">N/A</SelectItem>
                    <SelectItem value="parceiro_informado">Parceiro informado</SelectItem>
                    <SelectItem value="a_aguardar">A aguardar</SelectItem>
                    <SelectItem value="paga">Paga</SelectItem>
                    <SelectItem value="a_aguardar_resposta">A aguardar resposta</SelectItem>
                    <SelectItem value="nao_aceita">Não aceita</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Row>
          </Section>

          <Separator className="bg-[#F0EAE0]" />

          {/* Como conheceu a FBR */}
          <Section title="Como conheceu a FBR">
            <Row>
              <Field label="Canal">
                <Select value={local.how_found_fbr ?? ""} onValueChange={(v) => update("how_found_fbr", v as Order["how_found_fbr"])}>
                  <SelectTrigger className={inputCls}><SelectValue placeholder="—" /></SelectTrigger>
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
              </Field>
              <Field label="Código vale-presente">
                <Input className={inputCls} value={local.gift_voucher_code ?? ""} onChange={(e) => update("gift_voucher_code", e.target.value || null)} />
              </Field>
            </Row>
          </Section>

          <Separator className="bg-[#F0EAE0]" />

          {/* Notas */}
          <Section title="Notas adicionais">
            <Textarea
              className="text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F] resize-none"
              rows={3}
              value={local.additional_notes ?? ""}
              onChange={(e) => update("additional_notes", e.target.value || null)}
            />
          </Section>

          <Separator className="bg-[#F0EAE0]" />

          {/* Media / Drive */}
          <Section title="Ficheiros e media">
            <Field label="Pasta Google Drive (URL)">
              <div className="flex gap-1.5">
                <Input className={inputCls + " flex-1"} value={local.drive_folder_url ?? ""} onChange={(e) => update("drive_folder_url", e.target.value || null)} placeholder="https://drive.google.com/…" />
                {local.drive_folder_url && (
                  <a href={local.drive_folder_url} target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#E8E0D5] bg-[#FAF8F5] text-[#8B7355] hover:text-[#3D2B1F] transition-colors">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </Field>
            <Field label="URL foto das flores">
              <Input className={inputCls} value={local.flowers_photo_url ?? ""} onChange={(e) => update("flowers_photo_url", e.target.value || null)} placeholder="https://…" />
            </Field>
            <Field label="Idioma do formulário">
              <Select value={local.form_language} onValueChange={(v) => update("form_language", v as Order["form_language"])}>
                <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">Português</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </Section>

          <Separator className="bg-[#F0EAE0]" />

          {/* Entrega final e cupão */}
          <Section title="Entrega final e cupão">
            <Row>
              <Field label="Data entrega do quadro">
                <Input className={inputCls} type="date" value={toDateInput(local.frame_delivery_date)} onChange={(e) => update("frame_delivery_date", fromDateInput(e.target.value))} />
              </Field>
              <Field label="Feedback do cliente">
                <Select value={local.client_feedback_status} onValueChange={(v) => update("client_feedback_status", v as Order["client_feedback_status"])}>
                  <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="na">N/A</SelectItem>
                    <SelectItem value="deu_feedback">Deu feedback</SelectItem>
                    <SelectItem value="ja_pedido">Já pedido</SelectItem>
                    <SelectItem value="nao_disse_nada">Não disse nada</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Row>
            {local.coupon_code && (
              <div className="rounded-lg border border-[#E8E0D5] bg-white p-3 space-y-2">
                <p className="text-xs font-semibold text-[#8B7355]">Cupão 5%</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-sm tracking-widest border-[#C4A882] text-[#3D2B1F]">
                    {local.coupon_code}
                  </Badge>
                  <button
                    onClick={() => navigator.clipboard.writeText(local.coupon_code!)}
                    className="text-[#B8A99A] hover:text-[#3D2B1F] transition-colors"
                    title="Copiar código"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Row>
                  <Field label="Validade">
                    <Input className={inputCls} type="date" value={toDateInput(local.coupon_expiry)} onChange={(e) => update("coupon_expiry", fromDateInput(e.target.value))} />
                  </Field>
                  <Field label="Estado do cupão">
                    <Select value={local.coupon_status} onValueChange={(v) => update("coupon_status", v as Order["coupon_status"])}>
                      <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="na">N/A</SelectItem>
                        <SelectItem value="nao_utilizado">Não utilizado</SelectItem>
                        <SelectItem value="utilizado">Utilizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </Row>
              </div>
            )}
          </Section>

        </div>
      </SheetContent>
    </Sheet>
  );
}
