"use client";

// ============================================================
// COMPETIÇÃO (concorrentes e preços) — extraído de financas-client.tsx
// ============================================================

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Swords,
  Plus,
  ExternalLink,
  MapPin,
  Globe,
  Trash2,
  Save,
  X,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatEUR } from "@/lib/format";
import { toast } from "sonner";
import type { Competitor, CompetitorPrice } from "@/types/competitor";
import {
  createCompetitorAction,
  updateCompetitorAction,
  archiveCompetitorAction,
} from "../actions";

export function CompeticaoTab({
  competitors,
  canEdit,
}: {
  competitors: Competitor[];
  canEdit: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return competitors;
    const q = search.trim().toLowerCase();
    return competitors.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.location_label ?? "").toLowerCase().includes(q) ||
        c.websites.some((w) => w.toLowerCase().includes(q)),
    );
  }, [competitors, search]);

  // Estatísticas de referência: preço médio do nosso quadro mais pequeno
  // calculado a partir das tabelas dos concorrentes (referência visual).
  const stats = useMemo(() => {
    const allPrices = competitors.flatMap((c) => c.prices);
    const validPrices = allPrices.filter((p) => p.price !== null && p.price > 0);
    if (validPrices.length === 0) {
      return { count: competitors.length, avgPrice: null, minPrice: null, maxPrice: null };
    }
    const sum = validPrices.reduce((s, p) => s + (p.price ?? 0), 0);
    const prices = validPrices.map((p) => p.price!).sort((a, b) => a - b);
    return {
      count: competitors.length,
      avgPrice: sum / validPrices.length,
      minPrice: prices[0],
      maxPrice: prices[prices.length - 1],
    };
  }, [competitors]);

  return (
    <div className="space-y-4">
      {/* KPIs / sumário */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Concorrentes registados" value={String(stats.count)} color="from-violet-50 to-purple-100 border-violet-200" />
        <StatCard label="Preço médio (todos os produtos)" value={formatEUR(stats.avgPrice)} color="from-sky-50 to-blue-100 border-sky-200" />
        <StatCard label="Preço mais baixo" value={formatEUR(stats.minPrice)} color="from-emerald-50 to-green-100 border-emerald-200" />
        <StatCard label="Preço mais alto" value={formatEUR(stats.maxPrice)} color="from-amber-50 to-orange-100 border-amber-200" />
      </div>

      {/* Toolbar: search + novo */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cocoa-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar por nome, localização ou site…"
            className="pl-9 h-9"
          />
        </div>
        {canEdit && (
          <Button onClick={() => setShowNew(true)} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="h-4 w-4 mr-1" />
            Novo concorrente
          </Button>
        )}
      </div>

      {showNew && canEdit && (
        <NewCompetitorForm onClose={() => setShowNew(false)} />
      )}

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cream-200 bg-cream-50 p-12 text-center space-y-2">
          <Swords className="h-8 w-8 text-violet-400 mx-auto" />
          <p className="text-sm text-cocoa-700">
            {search.trim()
              ? `Nenhum concorrente corresponde a "${search}".`
              : "Ainda não há concorrentes registados."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((c) => (
            <CompetitorCard key={c.id} competitor={c} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br p-4 space-y-1",
        color,
      )}
    >
      <div className="text-[10px] uppercase tracking-wider font-semibold text-cocoa-900/60 dark:text-[#E8D5B5]/60">
        {label}
      </div>
      <div className="text-xl font-bold text-cocoa-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function NewCompetitorForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [location, setLocation] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    startTransition(async () => {
      try {
        await createCompetitorAction({
          name: name.trim(),
          websites: website.trim() ? [website.trim()] : [],
          location_label: location.trim() || null,
        });
        toast.success("Concorrente adicionado.");
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falhou.");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-violet-200 dark:border-violet-900/50 bg-violet-50/30 dark:bg-violet-950/20 p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-cocoa-900">
        Novo concorrente
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-cocoa-700">Nome *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: PressedFlowers Co." />
        </div>
        <div>
          <label className="text-xs text-cocoa-700">Site principal</label>
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className="text-xs text-cocoa-700">Localização</label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Lisboa / PT" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={pending} className="bg-violet-600 hover:bg-violet-700 text-white">
          <Save className="h-4 w-4 mr-1" />
          {pending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}

function CompetitorCard({
  competitor,
  canEdit,
}: {
  competitor: Competitor;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const minPrice = useMemo(() => {
    const valid = competitor.prices.filter((p) => p.price !== null && p.price > 0);
    if (valid.length === 0) return null;
    return Math.min(...valid.map((p) => p.price!));
  }, [competitor.prices]);

  async function archive() {
    if (!confirm(`Arquivar "${competitor.name}"?`)) return;
    try {
      await archiveCompetitorAction(competitor.id);
      toast.success("Concorrente arquivado.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falhou.");
    }
  }

  if (editing) {
    return (
      <EditCompetitorCard
        competitor={competitor}
        onClose={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-cream-200 bg-surface p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-cocoa-900">
            {competitor.name}
          </h3>
          {competitor.location_label && (
            <div className="inline-flex items-center gap-1 text-xs text-cocoa-700">
              <MapPin className="h-3 w-3" />
              {competitor.location_label}
              {competitor.country && competitor.country !== "PT" && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-300">
                  {competitor.country}
                </span>
              )}
            </div>
          )}
        </div>
        {minPrice !== null && (
          <div className="text-right shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-cocoa-700">A partir de</div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatEUR(minPrice)}
            </div>
          </div>
        )}
      </div>

      {competitor.websites.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {competitor.websites.map((url, idx) => (
            <a
              key={idx}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-sky-100 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200 border border-sky-300 dark:border-sky-900/50 hover:bg-sky-200 dark:hover:bg-sky-950/60 transition-colors"
            >
              <Globe className="h-3 w-3" />
              {prettyDomain(url)}
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          ))}
        </div>
      )}

      {competitor.prices.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-cocoa-700">
            Tabela de preços
          </div>
          <div className="space-y-1">
            {competitor.prices.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm py-1 border-b border-cream-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-cocoa-900 truncate">
                    {p.product || "—"}
                  </div>
                  {p.notes && (
                    <div className="text-[11px] text-cocoa-700 truncate">
                      {p.notes}
                    </div>
                  )}
                </div>
                <div className="tabular-nums font-semibold text-cocoa-900 shrink-0">
                  {formatEUR(p.price)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {competitor.notes && (
        <div className="text-xs text-cocoa-700 italic border-l-2 border-amber-300 pl-2">
          {competitor.notes}
        </div>
      )}

      {canEdit && (
        <div className="flex gap-2 pt-1 border-t border-cream-100">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button size="sm" variant="outline" onClick={archive} className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30">
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Arquivar
          </Button>
        </div>
      )}
    </div>
  );
}

function EditCompetitorCard({
  competitor,
  onClose,
}: {
  competitor: Competitor;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(competitor.name);
  const [location, setLocation] = useState(competitor.location_label ?? "");
  const [country, setCountry] = useState(competitor.country ?? "PT");
  const [websites, setWebsites] = useState<string[]>(
    competitor.websites.length ? competitor.websites : [""],
  );
  const [prices, setPrices] = useState<CompetitorPrice[]>(
    competitor.prices.length ? competitor.prices : [{ product: "", price: null, notes: null }],
  );
  const [notes, setNotes] = useState(competitor.notes ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      try {
        await updateCompetitorAction(competitor.id, {
          name: name.trim() || competitor.name,
          location_label: location.trim() || null,
          country: country.trim() || "PT",
          websites: websites.map((w) => w.trim()).filter(Boolean),
          prices: prices
            .filter((p) => p.product.trim() || p.price !== null)
            .map((p) => ({
              product: p.product.trim(),
              price: p.price,
              notes: p.notes?.trim() || null,
            })),
          notes: notes.trim() || null,
        });
        toast.success("Concorrente actualizado.");
        onClose();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falhou.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-violet-300 dark:border-violet-900/60 bg-violet-50/30 dark:bg-violet-950/20 p-5 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-cocoa-700">Nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="text-xs text-cocoa-700">Localização</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex.: Porto" />
          </div>
          <div>
            <label className="text-xs text-cocoa-700">País</label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="PT" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-cocoa-700">Sites / redes</label>
        <div className="space-y-1.5 mt-1">
          {websites.map((w, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={w}
                onChange={(e) => {
                  const next = [...websites];
                  next[idx] = e.target.value;
                  setWebsites(next);
                }}
                placeholder="https://…"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWebsites(websites.filter((_, i) => i !== idx))}
                disabled={websites.length === 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setWebsites([...websites, ""])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar site
          </Button>
        </div>
      </div>

      <div>
        <label className="text-xs text-cocoa-700">Tabela de preços</label>
        <div className="space-y-1.5 mt-1">
          {prices.map((p, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2">
              <Input
                className="col-span-5"
                value={p.product}
                onChange={(e) => {
                  const next = [...prices];
                  next[idx] = { ...p, product: e.target.value };
                  setPrices(next);
                }}
                placeholder="Produto (ex.: Quadro 30x40)"
              />
              <Input
                className="col-span-2"
                type="number"
                step="0.01"
                value={p.price ?? ""}
                onChange={(e) => {
                  const next = [...prices];
                  next[idx] = {
                    ...p,
                    price: e.target.value === "" ? null : parseFloat(e.target.value),
                  };
                  setPrices(next);
                }}
                placeholder="€"
              />
              <Input
                className="col-span-4"
                value={p.notes ?? ""}
                onChange={(e) => {
                  const next = [...prices];
                  next[idx] = { ...p, notes: e.target.value };
                  setPrices(next);
                }}
                placeholder="Notas (opcional)"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="col-span-1"
                onClick={() => setPrices(prices.filter((_, i) => i !== idx))}
                disabled={prices.length === 1}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPrices([...prices, { product: "", price: null, notes: null }])}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar produto
          </Button>
        </div>
      </div>

      <div>
        <label className="text-xs text-cocoa-700">Notas</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={pending}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Save className="h-4 w-4 mr-1" />
          {pending ? "A guardar…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

function prettyDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  }
}

