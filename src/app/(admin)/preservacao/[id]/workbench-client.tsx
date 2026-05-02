"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  ArrowLeft,
  Loader2,
  Check,
  ExternalLink,
  Copy,
  AlertTriangle,
} from "lucide-react";
import { updateOrderAction } from "../actions";
import type { Order, OrderUpdate } from "@/types/database";
import {
  STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
} from "@/types/database";
import { format, parseISO, differenceInDays } from "date-fns";
import { pt } from "date-fns/locale";

// ── Helpers ────────────────────────────────────────────────────

function toDateInput(val: string | null | undefined): string {
  if (!val) return "";
  try { return format(parseISO(val), "yyyy-MM-dd"); } catch { return ""; }
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return "—";
  try { return format(parseISO(val), "dd MMM yyyy", { locale: pt }); } catch { return "—"; }
}

function fmtEuro(val: number | null | undefined): string {
  if (val == null) return "—";
  return val.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

const STATUS_COLORS: Record<string, string> = {
  entrega_flores_agendar: "bg-amber-100 text-amber-800 border-amber-300",
  entrega_agendada:       "bg-blue-100 text-blue-800 border-blue-300",
  flores_enviadas:        "bg-blue-100 text-blue-800 border-blue-300",
  flores_recebidas:       "bg-blue-100 text-blue-800 border-blue-300",
  flores_na_prensa:       "bg-purple-100 text-purple-800 border-purple-300",
  reconstrucao_botanica:  "bg-purple-100 text-purple-800 border-purple-300",
  a_compor_design:        "bg-purple-100 text-purple-800 border-purple-300",
  a_aguardar_aprovacao:   "bg-purple-100 text-purple-800 border-purple-300",
  a_ser_emoldurado:       "bg-orange-100 text-orange-800 border-orange-300",
  emoldurado:             "bg-orange-100 text-orange-800 border-orange-300",
  a_ser_fotografado:      "bg-orange-100 text-orange-800 border-orange-300",
  quadro_pronto:          "bg-orange-100 text-orange-800 border-orange-300",
  quadro_enviado:         "bg-orange-100 text-orange-800 border-orange-300",
  quadro_recebido:        "bg-green-100 text-green-800 border-green-300",
  cancelado:              "bg-gray-100 text-gray-500 border-gray-300",
};

const PAYMENT_COLORS: Record<string, string> = {
  "100_pago":      "text-green-700 bg-green-50 border-green-200",
  "70_pago":       "text-yellow-700 bg-yellow-50 border-yellow-200",
  "30_pago":       "text-yellow-700 bg-yellow-50 border-yellow-200",
  "30_por_pagar":  "text-red-600 bg-red-50 border-red-200",
  "100_por_pagar": "text-red-700 bg-red-50 border-red-200",
};

// ── Componentes de layout ──────────────────────────────────────

function Card({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[#E8E0D5] bg-white overflow-hidden">
      <div className={`px-5 py-3 border-b border-[#F0EAE0] ${accent ?? "bg-white"}`}>
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#B8A99A]">{title}</p>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function Field({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={`space-y-1.5 ${span2 ? "col-span-2" : ""}`}>
      <Label className="text-xs font-medium text-[#8B7355]">{label}</Label>
      {children}
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(!!v)}
        className="border-[#C4A882] data-[state=checked]:bg-[#3D2B1F] data-[state=checked]:border-[#3D2B1F]"
      />
      <span className="text-sm text-[#3D2B1F]">{label}</span>
    </label>
  );
}

const inp = "h-9 text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F] rounded-lg";
const sel = "h-9 text-sm border-[#E8E0D5] bg-[#FAF8F5] text-[#3D2B1F] rounded-lg";

// ── Componente principal ───────────────────────────────────────

export default function WorkbenchClient({ order }: { order: Order }) {
  const router = useRouter();
  const [local, setLocal] = useState<Order>(order);
  const pendingRef = useRef<OrderUpdate>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    setLocal(order);
    pendingRef.current = {};
  }, [order]);

  const flush = useCallback(async () => {
    const updates = { ...pendingRef.current };
    if (Object.keys(updates).length === 0) return;
    pendingRef.current = {};
    clearTimeout(timerRef.current);
    setSaveState("saving");
    try {
      const updated = await updateOrderAction(order.id, updates);
      setLocal(updated);
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

  const daysUntilEvent = local.event_date
    ? differenceInDays(parseISO(local.event_date), new Date())
    : null;
  const urgentEvent = daysUntilEvent !== null && daysUntilEvent <= 5 && daysUntilEvent >= 0;
  const isWedding = local.event_type === "casamento";

  return (
    <div className="flex flex-col h-full bg-[#F7F4F0]">

      {/* ── Header fixo ──────────────────────────────────────── */}
      <header className="shrink-0 sticky top-0 z-20 bg-white border-b border-[#E8E0D5] shadow-sm">
        <div className="flex items-center gap-4 px-6 py-3">
          {/* Voltar */}
          <Link
            href="/preservacao"
            className="flex items-center gap-1.5 text-sm text-[#8B7355] hover:text-[#3D2B1F] transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Preservação</span>
          </Link>

          <Separator orientation="vertical" className="h-5 bg-[#E8E0D5]" />

          {/* Nome + ID */}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-[#3D2B1F] truncate leading-tight">
              {local.client_name}
            </h1>
            <p className="font-mono text-[10px] text-[#B8A99A] leading-tight">#{local.order_id}</p>
          </div>

          {/* Alertas */}
          {urgentEvent && (
            <div className="flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-600 font-medium shrink-0">
              <AlertTriangle className="h-3.5 w-3.5" />
              Evento em {daysUntilEvent}d
            </div>
          )}

          {/* Estado (destaque central) */}
          <div className="w-56 shrink-0">
            <Select
              value={local.status}
              onValueChange={(v) => update("status", v as Order["status"])}
            >
              <SelectTrigger className={`h-8 text-xs font-semibold border-2 ${STATUS_COLORS[local.status] ?? ""}`}>
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

          {/* Contactada */}
          <CheckRow
            label="Contactada"
            checked={local.contacted}
            onChange={(v) => update("contacted", v)}
          />

          {/* Indicador de gravação */}
          <div className="w-24 shrink-0 text-right text-xs">
            {saveState === "saving" && (
              <span className="flex items-center justify-end gap-1 text-[#B8A99A]">
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
        </div>
      </header>

      {/* ── Corpo ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-3 gap-5 p-6">

          {/* ═══════════════════════════════
              COLUNA ESQUERDA (2/3)
          ═══════════════════════════════ */}
          <div className="col-span-2 space-y-5">

            {/* Dados do cliente */}
            <Card title="Dados do cliente">
              <Grid2>
                <Field label="Nome na encomenda">
                  <Input className={inp} value={local.client_name} onChange={(e) => update("client_name", e.target.value)} />
                </Field>
                <Field label="Contacto preferido">
                  <Select value={local.contact_preference ?? ""} onValueChange={(v) => update("contact_preference", v as Order["contact_preference"])}>
                    <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Email">
                  <Input className={inp} type="email" value={local.email ?? ""} onChange={(e) => update("email", e.target.value || null)} />
                </Field>
                <Field label="Telemóvel">
                  <Input className={inp} value={local.phone ?? ""} onChange={(e) => update("phone", e.target.value || null)} />
                </Field>
              </Grid2>
            </Card>

            {/* Dados do evento */}
            <Card title="Dados do evento">
              <Grid2>
                <Field label="Tipo de evento">
                  <Select value={local.event_type ?? ""} onValueChange={(v) => update("event_type", v as Order["event_type"])}>
                    <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(EVENT_TYPE_LABELS) as Array<keyof typeof EVENT_TYPE_LABELS>).map((t) => (
                        <SelectItem key={t} value={t}>{EVENT_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Data do evento">
                  <Input
                    className={`${inp} ${urgentEvent ? "border-red-300 bg-red-50" : ""}`}
                    type="date"
                    value={toDateInput(local.event_date)}
                    onChange={(e) => update("event_date", e.target.value || null)}
                  />
                </Field>
                {isWedding && (
                  <Field label="Nome dos noivos" span2>
                    <Input className={inp} value={local.couple_names ?? ""} onChange={(e) => update("couple_names", e.target.value || null)} placeholder="Ana & João" />
                  </Field>
                )}
                <Field label="Localização do evento" span2>
                  <Input className={inp} value={local.event_location ?? ""} onChange={(e) => update("event_location", e.target.value || null)} placeholder="Quinta / Igreja / Cidade" />
                </Field>
              </Grid2>
            </Card>

            {/* Flores e quadro */}
            <Card title="Flores e quadro">
              <Grid2>
                <Field label="Tipo de flores" span2>
                  <Input className={inp} value={local.flower_type ?? ""} onChange={(e) => update("flower_type", e.target.value || null)} placeholder="Rosas, peónias, silvestres…" />
                </Field>
                <Field label="Envio das flores">
                  <Select value={local.flower_delivery_method ?? ""} onValueChange={(v) => update("flower_delivery_method", v as Order["flower_delivery_method"])}>
                    <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
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
                    <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maos">Em mãos</SelectItem>
                      <SelectItem value="ctt">CTT</SelectItem>
                      <SelectItem value="nao_sei">Não sei</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Tamanho da moldura">
                  <Select value={local.frame_size ?? ""} onValueChange={(v) => update("frame_size", v as Order["frame_size"])}>
                    <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
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
                    <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
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
              </Grid2>
            </Card>

            {/* Origem e notas */}
            <Card title="Origem e notas">
              <Grid2>
                <Field label="Como conheceu a FBR">
                  <Select value={local.how_found_fbr ?? ""} onValueChange={(v) => update("how_found_fbr", v as Order["how_found_fbr"])}>
                    <SelectTrigger className={sel}><SelectValue placeholder="—" /></SelectTrigger>
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
                  <Input className={inp} value={local.gift_voucher_code ?? ""} onChange={(e) => update("gift_voucher_code", e.target.value || null)} />
                </Field>
                <Field label="Notas adicionais" span2>
                  <Textarea
                    className="text-sm border-[#E8E0D5] bg-[#FAF8F5] focus:bg-white text-[#3D2B1F] rounded-lg resize-none"
                    rows={4}
                    value={local.additional_notes ?? ""}
                    onChange={(e) => update("additional_notes", e.target.value || null)}
                    placeholder="Pedidos especiais, informações relevantes…"
                  />
                </Field>
              </Grid2>
            </Card>

          </div>

          {/* ═══════════════════════════════
              COLUNA DIREITA (1/3)
          ═══════════════════════════════ */}
          <div className="col-span-1 space-y-5">

            {/* Finanças */}
            <Card title="Finanças">
              <div className="space-y-3">
                <Field label="Orçamento">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8B7355]">€</span>
                    <Input
                      className={inp + " pl-7"}
                      type="number" min={0} step={0.01}
                      value={local.budget ?? ""}
                      onChange={(e) => update("budget", e.target.value ? Number(e.target.value) : null)}
                    />
                  </div>
                </Field>
                <Field label="Pagamento">
                  <Select value={local.payment_status} onValueChange={(v) => update("payment_status", v as Order["payment_status"])}>
                    <SelectTrigger className={`${sel} font-medium ${PAYMENT_COLORS[local.payment_status] ?? ""}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PAYMENT_STATUS_LABELS) as Array<keyof typeof PAYMENT_STATUS_LABELS>).map((s) => (
                        <SelectItem key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="NIF">
                  <Input className={inp} value={local.nif ?? ""} onChange={(e) => update("nif", e.target.value || null)} />
                </Field>
                <CheckRow label="Precisa de fatura" checked={local.needs_invoice} onChange={(v) => update("needs_invoice", v)} />
              </div>
            </Card>

            {/* Envios */}
            <Card title="Envios">
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <Field label="Custo flores (€)">
                    <Input className={inp} type="number" min={0} step={0.01} value={local.flower_shipping_cost ?? ""} onChange={(e) => update("flower_shipping_cost", e.target.value ? Number(e.target.value) : null)} />
                  </Field>
                  <div className="pb-0.5">
                    <CheckRow label="Pago" checked={local.flower_shipping_paid} onChange={(v) => update("flower_shipping_paid", v)} />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <Field label="Custo quadro (€)">
                    <Input className={inp} type="number" min={0} step={0.01} value={local.frame_shipping_cost ?? ""} onChange={(e) => update("frame_shipping_cost", e.target.value ? Number(e.target.value) : null)} />
                  </Field>
                  <div className="pb-0.5">
                    <CheckRow label="Pago" checked={local.frame_shipping_paid} onChange={(v) => update("frame_shipping_paid", v)} />
                  </div>
                </div>
              </div>
            </Card>

            {/* Parceria */}
            <Card title="Parceria">
              <div className="space-y-3">
                <Field label="Comissão (€)">
                  <Input className={inp} type="number" min={0} step={0.01} value={local.partner_commission ?? ""} onChange={(e) => update("partner_commission", e.target.value ? Number(e.target.value) : null)} />
                </Field>
                <Field label="Estado da comissão">
                  <Select value={local.partner_commission_status} onValueChange={(v) => update("partner_commission_status", v as Order["partner_commission_status"])}>
                    <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
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
              </div>
            </Card>

            {/* Ficheiros */}
            <Card title="Ficheiros e media">
              <div className="space-y-3">
                <Field label="Pasta Google Drive">
                  <div className="flex gap-1.5">
                    <Input className={inp + " flex-1 min-w-0"} value={local.drive_folder_url ?? ""} onChange={(e) => update("drive_folder_url", e.target.value || null)} placeholder="https://drive.google.com/…" />
                    {local.drive_folder_url && (
                      <a href={local.drive_folder_url} target="_blank" rel="noopener noreferrer"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E8E0D5] bg-[#FAF8F5] text-[#8B7355] hover:bg-[#3D2B1F] hover:text-white hover:border-[#3D2B1F] transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </Field>
                <Field label="URL foto das flores">
                  <Input className={inp} value={local.flowers_photo_url ?? ""} onChange={(e) => update("flowers_photo_url", e.target.value || null)} placeholder="https://…" />
                </Field>
                <Field label="Idioma do formulário">
                  <Select value={local.form_language} onValueChange={(v) => update("form_language", v as Order["form_language"])}>
                    <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt">🇵🇹 Português</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Card>

            {/* Entrega e feedback */}
            <Card title="Entrega e feedback">
              <div className="space-y-3">
                <Field label="Data entrega do quadro">
                  <Input className={inp} type="date" value={toDateInput(local.frame_delivery_date)} onChange={(e) => update("frame_delivery_date", e.target.value || null)} />
                </Field>
                <Field label="Feedback do cliente">
                  <Select value={local.client_feedback_status} onValueChange={(v) => update("client_feedback_status", v as Order["client_feedback_status"])}>
                    <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="na">N/A</SelectItem>
                      <SelectItem value="deu_feedback">Deu feedback</SelectItem>
                      <SelectItem value="ja_pedido">Já pedido</SelectItem>
                      <SelectItem value="nao_disse_nada">Não disse nada</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Card>

            {/* Cupão (só aparece quando gerado) */}
            {local.coupon_code && (
              <Card title="Cupão 5%">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-base tracking-[0.2em] border-[#C4A882] text-[#3D2B1F] px-3 py-1">
                      {local.coupon_code}
                    </Badge>
                    <button
                      onClick={() => navigator.clipboard.writeText(local.coupon_code!)}
                      className="text-[#B8A99A] hover:text-[#3D2B1F] transition-colors"
                      title="Copiar"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <Field label="Validade">
                    <Input className={inp} type="date" value={toDateInput(local.coupon_expiry)} onChange={(e) => update("coupon_expiry", e.target.value || null)} />
                  </Field>
                  <Field label="Estado">
                    <Select value={local.coupon_status} onValueChange={(v) => update("coupon_status", v as Order["coupon_status"])}>
                      <SelectTrigger className={sel}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="na">N/A</SelectItem>
                        <SelectItem value="nao_utilizado">Não utilizado</SelectItem>
                        <SelectItem value="utilizado">Utilizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </Card>
            )}

            {/* Rodapé: metadados */}
            <div className="rounded-xl border border-[#E8E0D5] bg-white px-4 py-3 space-y-1">
              <p className="text-[10px] text-[#B8A99A]">
                Criada em {local.created_at ? format(parseISO(local.created_at), "dd MMM yyyy, HH:mm", { locale: pt }) : "—"}
              </p>
              {local.updated_at && local.updated_at !== local.created_at && (
                <p className="text-[10px] text-[#B8A99A]">
                  Actualizada em {format(parseISO(local.updated_at), "dd MMM yyyy, HH:mm", { locale: pt })}
                </p>
              )}
              <p className="font-mono text-[10px] text-[#D0C4B8]">{local.order_id}</p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
