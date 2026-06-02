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
  Star,
  AtSign,
  CalendarHeart,
  User,
  StickyNote,
  Loader2,
} from "lucide-react";
import { createFigureAction } from "./figuras-actions";
import {
  type PublicFigureInsert,
  type FigureType,
  type FigureStatus,
  type FigurePriority,
  type FigureEventType,
  type FigureContactChannel,
  FIGURE_TYPE_LABELS,
  FIGURE_STATUS_LABELS,
  FIGURE_STATUS_COLORS,
  FIGURE_STATUS_ORDER,
  FIGURE_PRIORITY_LABELS,
  FIGURE_EVENT_TYPE_LABELS,
  FIGURE_CONTACT_CHANNEL_LABELS,
} from "@/types/public-figure";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function initialForm(): PublicFigureInsert {
  return {
    name: "",
    figure_type: "influencer",
    status: "por_contactar",
    priority: "media",
    instagram_handle: null,
    tiktok_handle: null,
    followers: null,
    partner_name: null,
    partner_instagram: null,
    partner_followers: null,
    tags: [],
    event_type: "casamento",
    event_date: null,
    contact_channel: "instagram_dm",
    email: null,
    phones: [],
    notes: null,
    is_courtesy: true,
    interactions: [],
    actions: [],
    deliverables: [],
    story_screenshots: [],
  };
}

export default function NovaFiguraSheet({ open, onOpenChange, onSuccess }: Props) {
  const [form, setForm] = useState<PublicFigureInsert>(initialForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(o: boolean) {
    if (o) {
      setForm(initialForm());
      setError(null);
    }
    onOpenChange(o);
  }

  function set<K extends keyof PublicFigureInsert>(key: K, value: PublicFigureInsert[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setError(null);
    if (!form.name.trim()) {
      setError("O nome é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const payload: PublicFigureInsert = {
        ...form,
        name: form.name.trim(),
        instagram_handle: form.instagram_handle?.trim().replace(/^@/, "") || null,
        tiktok_handle: form.tiktok_handle?.trim().replace(/^@/, "") || null,
        partner_name: form.partner_name?.trim() || null,
        partner_instagram: form.partner_instagram?.trim().replace(/^@/, "") || null,
        email: form.email?.trim() || null,
        notes: form.notes?.trim() || null,
        event_date: form.event_date || null,
      };
      await createFigureAction(payload);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar figura.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-['TanMemories'] text-cocoa-900">Nova figura pública</SheetTitle>
          <SheetDescription>
            Adiciona uma influencer ou figura pública. Podes editar tudo depois no workbench.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-5">
          {/* Identificação */}
          <section className="space-y-3">
            <SectionTitle icon={Star} label="Identificação" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Ex: Sofia Costa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="partner_name">Par / cônjuge</Label>
                <Input
                  id="partner_name"
                  value={form.partner_name ?? ""}
                  onChange={(e) => set("partner_name", e.target.value)}
                  placeholder="Ex: João Silva"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.figure_type ?? "influencer"} onValueChange={(v) => set("figure_type", v as FigureType)}>
                  <SelectTrigger><SelectValue labels={FIGURE_TYPE_LABELS} /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FIGURE_TYPE_LABELS) as FigureType[]).map((k) => (
                      <SelectItem key={k} value={k}>{FIGURE_TYPE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.priority ?? "media"} onValueChange={(v) => set("priority", v as FigurePriority)}>
                  <SelectTrigger><SelectValue labels={FIGURE_PRIORITY_LABELS} /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FIGURE_PRIORITY_LABELS) as FigurePriority[]).map((k) => (
                      <SelectItem key={k} value={k}>{FIGURE_PRIORITY_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.status ?? "por_contactar"} onValueChange={(v) => set("status", v as FigureStatus)}>
                  <SelectTrigger><SelectValue labels={FIGURE_STATUS_LABELS} /></SelectTrigger>
                  <SelectContent>
                    {FIGURE_STATUS_ORDER.map((k) => (
                      <SelectItem key={k} value={k}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${FIGURE_STATUS_COLORS[k]}`}>
                          {FIGURE_STATUS_LABELS[k]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Redes */}
          <section className="space-y-3">
            <SectionTitle icon={AtSign} label="Redes sociais" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ig">Instagram (@)</Label>
                <Input
                  id="ig"
                  value={form.instagram_handle ?? ""}
                  onChange={(e) => set("instagram_handle", e.target.value)}
                  placeholder="sofiacosta"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tt">TikTok (@)</Label>
                <Input
                  id="tt"
                  value={form.tiktok_handle ?? ""}
                  onChange={(e) => set("tiktok_handle", e.target.value)}
                  placeholder="sofiacosta"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="followers">Nº de seguidores</Label>
              <Input
                id="followers"
                type="number"
                value={form.followers ?? ""}
                onChange={(e) => set("followers", e.target.value === "" ? null : parseInt(e.target.value, 10))}
                placeholder="Ex: 25000"
              />
            </div>
            {form.partner_name?.trim() && (
              <div className="rounded-lg border border-dashed border-cream-200 bg-cream-50/50 p-3 space-y-3">
                <p className="text-[11px] text-cocoa-700">
                  Preenche só se <strong>{form.partner_name.trim()}</strong> também for figura pública.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="partner_ig">Instagram do par (@)</Label>
                    <Input
                      id="partner_ig"
                      value={form.partner_instagram ?? ""}
                      onChange={(e) => set("partner_instagram", e.target.value)}
                      placeholder="joaosilva"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="partner_followers">Seguidores do par</Label>
                    <Input
                      id="partner_followers"
                      type="number"
                      value={form.partner_followers ?? ""}
                      onChange={(e) => set("partner_followers", e.target.value === "" ? null : parseInt(e.target.value, 10))}
                      placeholder="Ex: 12000"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Evento */}
          <section className="space-y-3">
            <SectionTitle icon={CalendarHeart} label="Evento" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo de evento</Label>
                <Select value={form.event_type ?? "casamento"} onValueChange={(v) => set("event_type", v as FigureEventType)}>
                  <SelectTrigger><SelectValue labels={FIGURE_EVENT_TYPE_LABELS} /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FIGURE_EVENT_TYPE_LABELS) as FigureEventType[]).map((k) => (
                      <SelectItem key={k} value={k}>{FIGURE_EVENT_TYPE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev_date">Data do evento</Label>
                <Input
                  id="ev_date"
                  type="date"
                  value={form.event_date ?? ""}
                  onChange={(e) => set("event_date", e.target.value || null)}
                />
              </div>
            </div>
          </section>

          {/* Contacto */}
          <section className="space-y-3">
            <SectionTitle icon={User} label="Contacto" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Canal preferido</Label>
                <Select value={form.contact_channel ?? "instagram_dm"} onValueChange={(v) => set("contact_channel", v as FigureContactChannel)}>
                  <SelectTrigger><SelectValue labels={FIGURE_CONTACT_CHANNEL_LABELS} /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FIGURE_CONTACT_CHANNEL_LABELS) as FigureContactChannel[]).map((k) => (
                      <SelectItem key={k} value={k}>{FIGURE_CONTACT_CHANNEL_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                  placeholder="contacto@…"
                />
              </div>
            </div>
          </section>

          {/* Notas */}
          <section className="space-y-3">
            <SectionTitle icon={StickyNote} label="Notas" />
            <Textarea
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Notas internas sobre esta figura…"
              rows={3}
            />
          </section>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-cream-200">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              className="bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-fg"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar figura"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cocoa-700">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}
