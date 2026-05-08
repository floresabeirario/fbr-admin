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
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Link as LinkIcon,
  StickyNote,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { createPartnerAction } from "./actions";
import {
  type PartnerInsert,
  type PartnerCategory,
  type PartnerStatus,
  type PartnerAcceptsCommission,
  PARTNER_CATEGORY_LABELS,
  PARTNER_STATUS_LABELS,
  PARTNER_STATUS_COLORS,
  PARTNER_ACCEPTS_COMMISSION_LABELS,
  PARTNER_STATUS_ORDER,
} from "@/types/partner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory: PartnerCategory;
  onSuccess: () => void;
}

function initialForm(category: PartnerCategory): PartnerInsert {
  return {
    name: "",
    category,
    status: "por_contactar",
    contact_person: null,
    email: null,
    phones: [],
    links: [],
    location_label: null,
    latitude: null,
    longitude: null,
    accepts_commission: "a_confirmar",
    notes: null,
    interactions: [],
    actions: [],
  };
}

export default function NovoParceiroSheet({ open, onOpenChange, defaultCategory, onSuccess }: Props) {
  const [form, setForm] = useState<PartnerInsert>(initialForm(defaultCategory));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [linkInput, setLinkInput] = useState("");

  // Reset quando abre/muda categoria
  function handleOpenChange(o: boolean) {
    if (o) {
      setForm(initialForm(defaultCategory));
      setError(null);
      setPhoneInput("");
      setLinkInput("");
    }
    onOpenChange(o);
  }

  function set<K extends keyof PartnerInsert>(key: K, value: PartnerInsert[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addPhone() {
    const t = phoneInput.trim();
    if (!t) return;
    set("phones", [...(form.phones ?? []), t]);
    setPhoneInput("");
  }

  function removePhone(i: number) {
    set("phones", (form.phones ?? []).filter((_, idx) => idx !== i));
  }

  function addLink() {
    const t = linkInput.trim();
    if (!t) return;
    set("links", [...(form.links ?? []), t]);
    setLinkInput("");
  }

  function removeLink(i: number) {
    set("links", (form.links ?? []).filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    setError(null);
    if (!form.name.trim()) {
      setError("O nome da empresa é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      // Limpar strings vazias para null
      const payload: PartnerInsert = {
        ...form,
        contact_person: form.contact_person?.trim() || null,
        email: form.email?.trim() || null,
        location_label: form.location_label?.trim() || null,
        notes: form.notes?.trim() || null,
        latitude: form.latitude ?? null,
        longitude: form.longitude ?? null,
      };
      await createPartnerAction(payload);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar parceiro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-['TanMemories'] text-[#3D2B1F]">
            Novo {PARTNER_CATEGORY_LABELS[defaultCategory].toLowerCase().replace(/s$/, "")}
          </SheetTitle>
          <SheetDescription>
            Adiciona um parceiro recomendador. Podes editar tudo depois no workbench.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-5">
          {/* Identificação */}
          <section className="space-y-3">
            <SectionTitle icon={Building2} label="Identificação" />
            <div className="space-y-2">
              <Label htmlFor="name">Nome da empresa *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Ex: Quinta da Bouça d'Arques"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => set("category", v as PartnerCategory)}>
                  <SelectTrigger>
                    <SelectValue labels={PARTNER_CATEGORY_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PARTNER_CATEGORY_LABELS) as PartnerCategory[]).map((k) => (
                      <SelectItem key={k} value={k}>{PARTNER_CATEGORY_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.status ?? "por_contactar"} onValueChange={(v) => set("status", v as PartnerStatus)}>
                  <SelectTrigger>
                    <SelectValue labels={PARTNER_STATUS_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTNER_STATUS_ORDER.map((k) => (
                      <SelectItem key={k} value={k}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PARTNER_STATUS_COLORS[k]}`}>
                          {PARTNER_STATUS_LABELS[k]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Contacto */}
          <section className="space-y-3">
            <SectionTitle icon={User} label="Contacto" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="contact_person">Pessoa responsável</Label>
                <Input
                  id="contact_person"
                  value={form.contact_person ?? ""}
                  onChange={(e) => set("contact_person", e.target.value)}
                  placeholder="Nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="contacto@empresa.pt"
                />
              </div>
            </div>

            {/* Telemóveis (múltiplos) */}
            <div className="space-y-2">
              <Label>Telemóveis</Label>
              {(form.phones ?? []).map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span className="flex-1 text-sm">{p}</span>
                  <button
                    type="button"
                    className="text-[#B8A99A] hover:text-rose-600"
                    onClick={() => removePhone(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addPhone(); }
                  }}
                  placeholder="+351 …"
                />
                <Button type="button" size="sm" variant="outline" onClick={addPhone}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Links (múltiplos) */}
            <div className="space-y-2">
              <Label>Links (site, Instagram, etc.)</Label>
              {(form.links ?? []).map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <LinkIcon className="h-3.5 w-3.5 text-[#8B7355]" />
                  <span className="flex-1 text-sm truncate">{l}</span>
                  <button
                    type="button"
                    className="text-[#B8A99A] hover:text-rose-600"
                    onClick={() => removeLink(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addLink(); }
                  }}
                  placeholder="https://…"
                />
                <Button type="button" size="sm" variant="outline" onClick={addLink}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </section>

          {/* Localização */}
          <section className="space-y-3">
            <SectionTitle icon={MapPin} label="Localização" />
            <div className="space-y-2">
              <Label htmlFor="location_label">Local de actuação</Label>
              <Input
                id="location_label"
                value={form.location_label ?? ""}
                onChange={(e) => set("location_label", e.target.value)}
                placeholder="Ex: Porto / Norte / Algarve"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="0.000001"
                  value={form.latitude ?? ""}
                  onChange={(e) => set("latitude", e.target.value === "" ? null : parseFloat(e.target.value))}
                  placeholder="41.15"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="0.000001"
                  value={form.longitude ?? ""}
                  onChange={(e) => set("longitude", e.target.value === "" ? null : parseFloat(e.target.value))}
                  placeholder="-8.61"
                />
              </div>
            </div>
            <p className="text-[11px] text-[#B8A99A]">
              Coordenadas opcionais. Procura no Google Maps, clica direito no local e copia a primeira linha (latitude, longitude).
            </p>
          </section>

          {/* Comissão */}
          <section className="space-y-3">
            <SectionTitle icon={Building2} label="Comissão" />
            <div className="space-y-2">
              <Label>Aceita 10% de comissão?</Label>
              <Select
                value={form.accepts_commission ?? "a_confirmar"}
                onValueChange={(v) => set("accepts_commission", v as PartnerAcceptsCommission)}
              >
                <SelectTrigger>
                  <SelectValue labels={PARTNER_ACCEPTS_COMMISSION_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PARTNER_ACCEPTS_COMMISSION_LABELS) as PartnerAcceptsCommission[]).map((k) => (
                    <SelectItem key={k} value={k}>{PARTNER_ACCEPTS_COMMISSION_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {/* Notas */}
          <section className="space-y-3">
            <SectionTitle icon={StickyNote} label="Notas" />
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Notas internas sobre este parceiro…"
              rows={3}
            />
          </section>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[#E8E0D5]">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="bg-[#3D2B1F] hover:bg-[#2C1F15] text-white"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar parceiro"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#8B7355]">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}
