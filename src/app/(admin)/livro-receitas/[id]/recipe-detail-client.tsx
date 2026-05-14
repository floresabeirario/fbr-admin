"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Plus,
  X,
  Flower2,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toEmbeddableImageUrl } from "@/lib/drive-url";

import type { Recipe, RecipeDifficulty, RecipeStep, RecipePhoto } from "@/types/recipe";
import {
  RECIPE_DIFFICULTY_LABELS,
  RECIPE_DIFFICULTY_COLORS,
  RECIPE_DIFFICULTY_ORDER,
} from "@/types/recipe";
import { updateRecipeAction, archiveRecipeAction } from "../actions";

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  try {
    return format(parseISO(value), "dd/MM/yyyy, HH:mm", { locale: pt });
  } catch {
    return "—";
  }
}

export default function RecipeDetailClient({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const [data, setData] = useState<Recipe>(recipe);
  const [saving, startSaving] = useTransition();
  const [archiving, startArchiving] = useTransition();
  const pendingRef = useRef<Partial<Recipe>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function flush() {
    const updates = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(updates).length === 0) return;
    startSaving(async () => {
      try {
        await updateRecipeAction(data.id, updates);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao guardar.");
      }
    });
  }

  function update<K extends keyof Recipe>(key: K, value: Recipe[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    pendingRef.current = { ...pendingRef.current, [key]: value };
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 800);
  }

  function handleArchive() {
    if (!confirm("Arquivar esta receita? (pode ser restaurada por admin)")) return;
    startArchiving(async () => {
      try {
        await archiveRecipeAction(data.id);
        toast.success("Receita arquivada.");
        router.push("/livro-receitas");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao arquivar.");
      }
    });
  }

  // ── Steps ──
  function addStep() {
    const newStep: RecipeStep = {
      order: data.steps.length + 1,
      title: "",
      body: "",
    };
    update("steps", [...data.steps, newStep]);
  }
  function updateStep(idx: number, patch: Partial<RecipeStep>) {
    update(
      "steps",
      data.steps.map((s, i) => (i === idx ? { ...s, ...patch } : s))
    );
  }
  function removeStep(idx: number) {
    update(
      "steps",
      data.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 }))
    );
  }

  // ── Photos ──
  function addPhoto() {
    const url = window.prompt("URL da foto (Google Drive ou directa)");
    if (!url?.trim()) return;
    const newPhoto: RecipePhoto = { url: url.trim() };
    update("photos", [...data.photos, newPhoto]);
  }
  function updatePhoto(idx: number, patch: Partial<RecipePhoto>) {
    update(
      "photos",
      data.photos.map((p, i) => (i === idx ? { ...p, ...patch } : p))
    );
  }
  function removePhoto(idx: number) {
    update("photos", data.photos.filter((_, i) => i !== idx));
  }

  const inp = "h-9 text-sm border-cream-200 bg-surface";

  return (
    <div className="max-w-[1100px] mx-auto p-3 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/livro-receitas"
          className="inline-flex items-center gap-1.5 text-sm text-cocoa-700 hover:text-cocoa-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-cocoa-500">A guardar...</span>}
          <Button
            variant="outline"
            size="sm"
            onClick={handleArchive}
            disabled={archiving}
            className="border-red-200 text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Arquivar
          </Button>
        </div>
      </div>

      {/* Hero */}
      <div className="rounded-xl border border-pink-200 bg-gradient-to-br from-pink-50/80 to-rose-50/60 p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 shadow-sm flex items-center justify-center shrink-0">
            <Flower2 className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 space-y-2">
            <Input
              value={data.flower_name}
              onChange={(e) => update("flower_name", e.target.value)}
              placeholder="Nome da flor"
              className="text-2xl font-semibold border-0 bg-transparent px-0 focus-visible:ring-0 h-auto"
            />
            <Input
              value={data.scientific_name ?? ""}
              onChange={(e) => update("scientific_name", e.target.value || null)}
              placeholder="Nome científico (opcional)"
              className="italic text-sm text-cocoa-700 border-0 bg-transparent px-0 focus-visible:ring-0 h-auto"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-cocoa-700 block mb-1">
              Dificuldade
            </label>
            <Select value={data.difficulty} onValueChange={(v) => update("difficulty", v as RecipeDifficulty)}>
              <SelectTrigger className={cn(inp, "font-medium", RECIPE_DIFFICULTY_COLORS[data.difficulty])}>
                <SelectValue labels={RECIPE_DIFFICULTY_LABELS} />
              </SelectTrigger>
              <SelectContent>
                {RECIPE_DIFFICULTY_ORDER.map((d) => (
                  <SelectItem key={d} value={d}>
                    {RECIPE_DIFFICULTY_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-cocoa-700 block mb-1">
              Prensa mínima (dias)
            </label>
            <Input
              type="number"
              min={0}
              value={data.press_days_min ?? ""}
              onChange={(e) => update("press_days_min", e.target.value ? Number(e.target.value) : null)}
              className={inp}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-cocoa-700 block mb-1">
              Prensa máxima (dias)
            </label>
            <Input
              type="number"
              min={0}
              value={data.press_days_max ?? ""}
              onChange={(e) => update("press_days_max", e.target.value ? Number(e.target.value) : null)}
              className={inp}
            />
          </div>
        </div>
      </div>

      {/* Apresentação */}
      <section className="rounded-xl border border-cream-200 bg-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-cocoa-900 uppercase tracking-wider">
          Apresentação
        </h2>
        <Textarea
          placeholder="Apresentação da flor, particularidades, cuidados iniciais..."
          value={data.intro ?? ""}
          onChange={(e) => update("intro", e.target.value || null)}
          rows={4}
          className="text-sm"
        />
      </section>

      {/* Passos */}
      <section className="rounded-xl border border-cream-200 bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-cocoa-900 uppercase tracking-wider">
            Passos da preservação
          </h2>
          <Button size="sm" variant="outline" onClick={addStep} className="h-7 gap-1">
            <Plus className="h-3 w-3" />
            Passo
          </Button>
        </div>
        {data.steps.length === 0 ? (
          <p className="text-sm text-cocoa-500 italic">
            Ainda sem passos. Adiciona o primeiro para registar o processo.
          </p>
        ) : (
          <ol className="space-y-3">
            {data.steps.map((step, idx) => (
              <li key={idx} className="rounded-lg border border-cream-100 bg-[#FDFCFB] p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold shrink-0">
                    {step.order}
                  </span>
                  <Input
                    placeholder="Título do passo (ex.: Corte e selecção)"
                    value={step.title}
                    onChange={(e) => updateStep(idx, { title: e.target.value })}
                    className="h-8 text-sm font-medium"
                  />
                  <button
                    onClick={() => removeStep(idx)}
                    className="text-cocoa-500 hover:text-rose-600 transition-colors"
                    title="Remover passo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Textarea
                  placeholder="Descrição detalhada..."
                  value={step.body}
                  onChange={(e) => updateStep(idx, { body: e.target.value })}
                  rows={3}
                  className="text-sm"
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Observações */}
      <section className="rounded-xl border border-cream-200 bg-surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-cocoa-900 uppercase tracking-wider">
          Observações
        </h2>
        <Textarea
          placeholder="Notas, erros comuns, dicas, particularidades..."
          value={data.observations ?? ""}
          onChange={(e) => update("observations", e.target.value || null)}
          rows={4}
          className="text-sm"
        />
      </section>

      {/* Fotos */}
      <section className="rounded-xl border border-cream-200 bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-cocoa-900 uppercase tracking-wider">
            Fotos
          </h2>
          <Button size="sm" variant="outline" onClick={addPhoto} className="h-7 gap-1">
            <Plus className="h-3 w-3" />
            Foto
          </Button>
        </div>
        {data.photos.length === 0 ? (
          <p className="text-sm text-cocoa-500 italic">
            Sem fotos. Adiciona URLs do Drive ou directas.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.photos.map((photo, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="relative aspect-square rounded-lg overflow-hidden border border-cream-200 bg-pink-50/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={toEmbeddableImageUrl(photo.url) ?? photo.url}
                    alt={photo.caption ?? ""}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center transition-colors"
                    title="Remover foto"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  placeholder="Legenda (opcional)"
                  value={photo.caption ?? ""}
                  onChange={(e) => updatePhoto(idx, { caption: e.target.value || null })}
                  className="h-7 text-xs"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Metadata */}
      <div className="text-xs text-cocoa-500 flex flex-wrap gap-4 pt-2 border-t border-cream-100">
        <span>Criada em {formatTimestamp(data.created_at)}</span>
        <span>Última edição {formatTimestamp(data.updated_at)}</span>
        {data.created_by_email && (
          <span>Por {data.created_by_email}</span>
        )}
      </div>
    </div>
  );
}
