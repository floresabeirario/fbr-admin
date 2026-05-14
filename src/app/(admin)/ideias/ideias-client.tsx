"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import {
  Lightbulb,
  Plus,
  Search,
  Trash2,
  Save,
  X,
} from "lucide-react";
import { toast } from "sonner";

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

import type { Idea, IdeaImportance, IdeaStatus, IdeaTheme } from "@/types/idea";
import {
  IDEA_IMPORTANCE_LABELS,
  IDEA_IMPORTANCE_COLORS,
  IDEA_IMPORTANCE_ORDER,
  IDEA_THEME_LABELS,
  IDEA_STATUS_LABELS,
  IDEA_STATUS_COLORS,
} from "@/types/idea";
import { createIdeaAction, updateIdeaAction, archiveIdeaAction } from "./actions";

type GroupBy = "importance" | "theme" | "status";

export default function IdeiasClient({
  initialIdeas,
  currentEmail,
}: {
  initialIdeas: Idea[];
  currentEmail: string | null;
}) {
  const [groupBy, setGroupBy] = useState<GroupBy>("importance");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  // Esconder concluídas/rejeitadas por defeito
  const [showCompleted, setShowCompleted] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialIdeas.filter((i) => {
      if (!showCompleted && (i.status === "concluida" || i.status === "rejeitada")) {
        return false;
      }
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        (i.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [initialIdeas, showCompleted, search]);

  const groups = useMemo(() => {
    if (groupBy === "importance") {
      return IDEA_IMPORTANCE_ORDER.map((imp) => ({
        key: imp as string,
        label: IDEA_IMPORTANCE_LABELS[imp],
        items: filtered.filter((i) => i.importance === imp),
      }));
    }
    if (groupBy === "theme") {
      const themes = Array.from(new Set(filtered.map((i) => i.theme)));
      return themes.map((t) => ({
        key: t as string,
        label: IDEA_THEME_LABELS[t],
        items: filtered.filter((i) => i.theme === t),
      }));
    }
    const statuses: IdeaStatus[] = ["em_curso", "planeada", "em_avaliacao", "proposta", "concluida", "rejeitada"];
    return statuses.map((s) => ({
      key: s as string,
      label: IDEA_STATUS_LABELS[s],
      items: filtered.filter((i) => i.status === s),
    }));
  }, [filtered, groupBy]);

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 shadow-sm flex items-center justify-center">
            <Lightbulb className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-cocoa-900">
              Ideias Futuras
            </h1>
            <p className="text-sm text-cocoa-700">
              {initialIdeas.length} ideia(s) registada(s)
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowNew(true)}
          size="sm"
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Plus className="h-4 w-4 mr-1" />
          Nova ideia
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cocoa-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Procurar…"
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center rounded-lg border border-cream-200 overflow-hidden">
          {(["importance", "theme", "status"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={cn(
                "px-3 h-9 text-xs font-medium transition-colors",
                groupBy === g
                  ? "bg-btn-primary text-btn-primary-fg"
                  : "text-cocoa-700 hover:bg-cream-50",
              )}
            >
              {g === "importance" ? "Importância" : g === "theme" ? "Tema" : "Estado"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCompleted((v) => !v)}
          className={cn(
            "h-9 px-3 rounded-lg border text-xs font-medium transition-colors",
            showCompleted
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-cream-200 bg-surface text-cocoa-900 hover:bg-cream-50",
          )}
        >
          {showCompleted ? "Esconder concluídas" : "Mostrar concluídas"}
        </button>
      </div>

      {/* Nova ideia (form inline) */}
      {showNew && (
        <NewIdeaForm
          currentEmail={currentEmail}
          onClose={() => setShowNew(false)}
        />
      )}

      {/* Listagem agrupada */}
      <div className="space-y-5">
        {groups.map((g) => (
          <GroupSection key={g.key} label={g.label} count={g.items.length}>
            {g.items.length === 0 ? null : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {g.items.map((i) => (
                  <IdeaCard key={i.id} idea={i} />
                ))}
              </div>
            )}
          </GroupSection>
        ))}
      </div>
    </div>
  );
}

function GroupSection({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-cocoa-900">
          {label}
        </h2>
        <span className="text-[10px] uppercase tracking-wider rounded-full bg-cream-100 text-cocoa-700 px-2 py-0.5 font-bold">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function IdeaCard({ idea }: { idea: Idea }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  function update<K extends keyof Idea>(field: K, value: Idea[K]) {
    if (value === idea[field]) return;
    setBusy(true);
    startTransition(async () => {
      try {
        await updateIdeaAction(idea.id, { [field]: value } as Partial<Idea>);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao guardar");
      } finally {
        setBusy(false);
      }
    });
  }

  async function archive() {
    if (!confirm("Apagar esta ideia?")) return;
    setBusy(true);
    try {
      await archiveIdeaAction(idea.id);
      toast.success("Ideia apagada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao apagar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-cream-200 bg-surface p-4 space-y-2.5">
      {editing ? (
        <EditableTitle
          initial={idea.title}
          onSave={(v) => {
            update("title", v);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-left w-full text-sm font-semibold text-cocoa-900 hover:underline"
        >
          {idea.title}
        </button>
      )}

      {idea.description && (
        <p className="text-xs text-cocoa-700 leading-relaxed whitespace-pre-wrap">
          {idea.description}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <Select value={idea.importance} onValueChange={(v) => update("importance", v as IdeaImportance)}>
          <SelectTrigger className={cn("h-7 text-[10px] font-semibold rounded-md uppercase tracking-wider w-auto px-2 border", IDEA_IMPORTANCE_COLORS[idea.importance])}>
            <SelectValue labels={IDEA_IMPORTANCE_LABELS} />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(IDEA_IMPORTANCE_LABELS) as IdeaImportance[]).map((k) => (
              <SelectItem key={k} value={k}>{IDEA_IMPORTANCE_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={idea.theme} onValueChange={(v) => update("theme", v as IdeaTheme)}>
          <SelectTrigger className="h-7 text-[10px] font-medium rounded-md uppercase tracking-wider w-auto px-2 border bg-cream-50 text-cocoa-700 border-cream-200">
            <SelectValue labels={IDEA_THEME_LABELS} />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(IDEA_THEME_LABELS) as IdeaTheme[]).map((k) => (
              <SelectItem key={k} value={k}>{IDEA_THEME_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={idea.status} onValueChange={(v) => update("status", v as IdeaStatus)}>
          <SelectTrigger className={cn("h-7 text-[10px] font-semibold rounded-md uppercase tracking-wider w-auto px-2 border", IDEA_STATUS_COLORS[idea.status])}>
            <SelectValue labels={IDEA_STATUS_LABELS} />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[]).map((k) => (
              <SelectItem key={k} value={k}>{IDEA_STATUS_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <button
          type="button"
          onClick={archive}
          disabled={busy}
          className="text-cocoa-500 hover:text-red-500 transition-colors disabled:opacity-40"
          title="Apagar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="text-[10px] text-cocoa-500 pt-1 border-t border-cream-100 flex items-center gap-1.5">
        {idea.created_by_email && (
          <span className="font-medium">{shortName(idea.created_by_email)}</span>
        )}
        <span>·</span>
        <span>{format(parseISO(idea.created_at), "dd/MM/yyyy", { locale: pt })}</span>
      </div>
    </div>
  );
}

function shortName(email: string): string {
  if (email.includes("antonio")) return "António";
  if (email.includes("mj")) return "MJ";
  if (email.includes("ana")) return "Ana";
  return email.split("@")[0];
}

function EditableTitle({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (v: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(initial);
  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        autoFocus
        className="h-8 text-sm font-semibold"
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim()) onSave(val.trim());
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        type="button"
        onClick={() => val.trim() && onSave(val.trim())}
        className="h-8 px-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
      >
        <Save className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-8 px-2 rounded-md border border-cream-200 text-cocoa-700 hover:bg-cream-50"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function NewIdeaForm({
  currentEmail,
  onClose,
}: {
  currentEmail: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [importance, setImportance] = useState<IdeaImportance>("media");
  const [theme, setTheme] = useState<IdeaTheme>("outro");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title.trim()) {
      toast.error("Indica um título");
      return;
    }
    setBusy(true);
    try {
      await createIdeaAction({
        title: title.trim(),
        description: description.trim() || undefined,
        importance,
        theme,
        status: "proposta",
        created_by_email: currentEmail ?? undefined,
      });
      toast.success("Ideia adicionada");
      router.refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao adicionar");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-cocoa-900">Nova ideia</h3>
        <button onClick={onClose} className="text-cocoa-700 hover:text-cocoa-900">
          <X className="h-4 w-4" />
        </button>
      </div>
      <Input
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        className="h-9"
      />
      <Textarea
        placeholder="Descrição (opcional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="text-sm"
      />
      <div className="grid grid-cols-2 gap-2">
        <Select value={importance} onValueChange={(v) => setImportance(v as IdeaImportance)}>
          <SelectTrigger className="h-9">
            <SelectValue labels={IDEA_IMPORTANCE_LABELS} />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(IDEA_IMPORTANCE_LABELS) as IdeaImportance[]).map((k) => (
              <SelectItem key={k} value={k}>{IDEA_IMPORTANCE_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={theme} onValueChange={(v) => setTheme(v as IdeaTheme)}>
          <SelectTrigger className="h-9">
            <SelectValue labels={IDEA_THEME_LABELS} />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(IDEA_THEME_LABELS) as IdeaTheme[]).map((k) => (
              <SelectItem key={k} value={k}>{IDEA_THEME_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={submit}
          disabled={busy || !title.trim()}
          className="bg-amber-600 hover:bg-amber-700 text-white"
        >
          {busy ? "A guardar…" : "Adicionar"}
        </Button>
      </div>
    </div>
  );
}
