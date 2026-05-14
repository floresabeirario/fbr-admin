"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Plus,
  Search,
  Flower2,
  Clock,
  ImageIcon,
  ListOrdered,
} from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
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

import type { Recipe, RecipeDifficulty } from "@/types/recipe";
import {
  RECIPE_DIFFICULTY_LABELS,
  RECIPE_DIFFICULTY_COLORS,
  RECIPE_DIFFICULTY_ORDER,
} from "@/types/recipe";
import { createRecipeAction } from "./actions";

export default function LivroReceitasClient({
  initialRecipes,
}: {
  initialRecipes: Recipe[];
  currentEmail: string | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<RecipeDifficulty | "todas">("todas");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDifficulty, setNewDifficulty] = useState<RecipeDifficulty>("media");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialRecipes.filter((r) => {
      if (difficulty !== "todas" && r.difficulty !== difficulty) return false;
      if (!q) return true;
      return (
        r.flower_name.toLowerCase().includes(q) ||
        (r.scientific_name ?? "").toLowerCase().includes(q) ||
        (r.intro ?? "").toLowerCase().includes(q)
      );
    });
  }, [initialRecipes, search, difficulty]);

  function handleCreate() {
    if (!newName.trim()) {
      toast.error("Indica o nome da flor.");
      return;
    }
    startTransition(async () => {
      try {
        const recipe = await createRecipeAction({
          flower_name: newName.trim(),
          difficulty: newDifficulty,
        });
        toast.success("Receita criada.");
        setCreating(false);
        setNewName("");
        setNewDifficulty("media");
        router.push(`/livro-receitas/${recipe.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar receita.");
      }
    });
  }

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 shadow-sm flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-[#3D2B1F] dark:text-[#E8D5B5]">
              Livro de Receitas
            </h1>
            <p className="text-sm text-[#8B7355]">
              Wiki interno: o &quot;how-to&quot; da preservação por tipo de flor.
            </p>
          </div>
        </div>
        <Button
          onClick={() => setCreating((v) => !v)}
          className="bg-[#3D2B1F] hover:bg-[#2C1F15] text-white gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Nova receita
        </Button>
      </div>

      {/* Form de criar */}
      {creating && (
        <div className="rounded-xl border border-pink-200 bg-pink-50/60 p-4 space-y-3">
          <h2 className="text-sm font-semibold text-rose-900">Nova receita</h2>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2">
            <Input
              placeholder="Nome da flor (ex.: Rosa, Peónia, Silvestres)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <Select value={newDifficulty} onValueChange={(v) => setNewDifficulty(v as RecipeDifficulty)}>
              <SelectTrigger>
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
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={pending} className="bg-[#3D2B1F] hover:bg-[#2C1F15] text-white">
                Criar e abrir
              </Button>
              <Button variant="outline" onClick={() => setCreating(false)} disabled={pending}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B8A99A]" />
          <Input
            placeholder="Pesquisar receita..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={difficulty} onValueChange={(v) => setDifficulty(v as RecipeDifficulty | "todas")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as dificuldades</SelectItem>
            {RECIPE_DIFFICULTY_ORDER.map((d) => (
              <SelectItem key={d} value={d}>
                {RECIPE_DIFFICULTY_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid de receitas */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E8E0D5] bg-white p-12 text-center">
          <Flower2 className="h-12 w-12 mx-auto text-pink-300 mb-3" />
          <p className="text-sm text-[#8B7355]">
            {initialRecipes.length === 0
              ? "Ainda não há receitas. Cria a primeira para registar o conhecimento da preservação."
              : "Nenhuma receita corresponde aos filtros."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const firstPhoto = recipe.photos[0]?.url;
  const pressLabel =
    recipe.press_days_min && recipe.press_days_max
      ? recipe.press_days_min === recipe.press_days_max
        ? `${recipe.press_days_min} dias`
        : `${recipe.press_days_min}–${recipe.press_days_max} dias`
      : recipe.press_days_min
        ? `${recipe.press_days_min}+ dias`
        : null;

  return (
    <Link
      href={`/livro-receitas/${recipe.id}`}
      className="group rounded-xl border border-[#E8E0D5] bg-white overflow-hidden hover:shadow-md hover:border-pink-300 transition-all"
    >
      <div className="relative aspect-[4/3] bg-gradient-to-br from-pink-100 to-rose-100 overflow-hidden">
        {firstPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={toEmbeddableImageUrl(firstPhoto) ?? firstPhoto}
            alt={recipe.flower_name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Flower2 className="h-16 w-16 text-pink-300/60" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
            RECIPE_DIFFICULTY_COLORS[recipe.difficulty]
          )}>
            {RECIPE_DIFFICULTY_LABELS[recipe.difficulty]}
          </span>
        </div>
      </div>
      <div className="p-4 space-y-2">
        <div>
          <h3 className="font-semibold text-[#3D2B1F] group-hover:text-rose-700 transition-colors">
            {recipe.flower_name}
          </h3>
          {recipe.scientific_name && (
            <p className="text-xs italic text-[#B8A99A]">{recipe.scientific_name}</p>
          )}
        </div>
        {recipe.intro && (
          <p className="text-sm text-[#8B7355] line-clamp-2">{recipe.intro}</p>
        )}
        <div className="flex flex-wrap gap-3 text-xs text-[#8B7355] pt-1">
          {pressLabel && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {pressLabel}
            </span>
          )}
          {recipe.steps.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ListOrdered className="h-3 w-3" />
              {recipe.steps.length} {recipe.steps.length === 1 ? "passo" : "passos"}
            </span>
          )}
          {recipe.photos.length > 0 && (
            <span className="inline-flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              {recipe.photos.length} {recipe.photos.length === 1 ? "foto" : "fotos"}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
