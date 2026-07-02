"use client";

import { useMemo, useState, useTransition } from "react";
import {
  ListTodo,
  Pencil,
  Archive,
  Plus,
  RotateCcw,
  Save,
  X,
  Receipt,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SistemaTopbar from "@/components/sistema-topbar";
import {
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_TEMPLATE_VARIABLES,
  type TaskCategory,
  type TaskPriority,
  type TaskTemplate,
  type TaskTemplateScope,
} from "@/types/tasks";
import {
  createTaskTemplateAction,
  updateTaskTemplateAction,
  archiveTaskTemplateAction,
  restoreTaskTemplateAction,
} from "./actions";

const SCOPE_LABELS: Record<TaskTemplateScope, string> = {
  order: "Encomenda",
  voucher: "Vale",
  both: "Ambos",
};

const SCOPE_COLORS: Record<TaskTemplateScope, string> = {
  order:   "bg-sky-100 text-sky-800 border-sky-300",
  voucher: "bg-violet-100 text-violet-800 border-violet-300",
  both:    "bg-emerald-100 text-emerald-800 border-emerald-300",
};

type Draft = {
  id: string | null;       // null = a criar
  slug: string;
  name: string;
  title_template: string;
  description_template: string;
  default_category: TaskCategory;
  default_priority: TaskPriority;
  needs_amount: boolean;
  amount_label: string;
  scope: TaskTemplateScope;
};

const EMPTY_DRAFT: Draft = {
  id: null,
  slug: "",
  name: "",
  title_template: "",
  description_template: "",
  default_category: "outros",
  default_priority: "media",
  needs_amount: false,
  amount_label: "",
  scope: "order",
};

export default function TaskTemplatesClient({
  initialTemplates,
}: {
  initialTemplates: TaskTemplate[];
}) {
  const [templates, setTemplates] = useState<TaskTemplate[]>(initialTemplates);
  const [showArchived, setShowArchived] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(
    () =>
      templates.filter((t) =>
        showArchived ? t.deleted_at !== null : t.deleted_at === null,
      ),
    [templates, showArchived],
  );

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT });
  }

  function openEdit(t: TaskTemplate) {
    setDraft({
      id: t.id,
      slug: t.slug,
      name: t.name,
      title_template: t.title_template,
      description_template: t.description_template ?? "",
      default_category: t.default_category,
      default_priority: t.default_priority,
      needs_amount: t.needs_amount,
      amount_label: t.amount_label ?? "",
      scope: t.scope,
    });
  }

  function handleSave() {
    if (!draft) return;
    const name = draft.name.trim();
    const titleTemplate = draft.title_template.trim();
    if (!name) {
      toast.error("Dá um nome ao template");
      return;
    }
    if (!titleTemplate) {
      toast.error("O título do template não pode ficar vazio");
      return;
    }

    startTransition(async () => {
      try {
        if (draft.id) {
          await updateTaskTemplateAction(draft.id, {
            name,
            title_template: titleTemplate,
            description_template: draft.description_template.trim() || null,
            default_category: draft.default_category,
            default_priority: draft.default_priority,
            needs_amount: draft.needs_amount,
            amount_label: draft.needs_amount
              ? draft.amount_label.trim() || "Valor"
              : null,
            scope: draft.scope,
          });
          setTemplates((prev) =>
            prev.map((t) =>
              t.id === draft.id
                ? {
                    ...t,
                    name,
                    title_template: titleTemplate,
                    description_template: draft.description_template.trim() || null,
                    default_category: draft.default_category,
                    default_priority: draft.default_priority,
                    needs_amount: draft.needs_amount,
                    amount_label: draft.needs_amount
                      ? draft.amount_label.trim() || "Valor"
                      : null,
                    scope: draft.scope,
                  }
                : t,
            ),
          );
          toast.success("Template guardado");
        } else {
          const slug =
            draft.slug.trim() ||
            name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 50);
          await createTaskTemplateAction({
            slug,
            name,
            title_template: titleTemplate,
            description_template: draft.description_template.trim() || null,
            default_category: draft.default_category,
            default_priority: draft.default_priority,
            needs_amount: draft.needs_amount,
            amount_label: draft.needs_amount
              ? draft.amount_label.trim() || "Valor"
              : null,
            scope: draft.scope,
            position: templates.length,
          });
          // Server re-fetch via revalidatePath cobre o estado real. Para
          // feedback imediato sem refetch local, fechamos só o diálogo.
          toast.success("Template criado");
        }
        setDraft(null);
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  function handleArchive(t: TaskTemplate) {
    if (!confirm(`Arquivar "${t.name}"?`)) return;
    startTransition(async () => {
      try {
        await archiveTaskTemplateAction(t.id);
        setTemplates((prev) =>
          prev.map((x) =>
            x.id === t.id ? { ...x, deleted_at: new Date().toISOString() } : x,
          ),
        );
        toast.success("Template arquivado");
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  function handleRestore(t: TaskTemplate) {
    startTransition(async () => {
      try {
        await restoreTaskTemplateAction(t.id);
        setTemplates((prev) =>
          prev.map((x) => (x.id === t.id ? { ...x, deleted_at: null } : x)),
        );
        toast.success("Template restaurado");
      } catch (err) {
        toast.error((err as Error).message);
      }
    });
  }

  function copyVariable(v: string) {
    navigator.clipboard.writeText(v).then(
      () => toast.success(`${v} copiado`),
      () => toast.error("Não foi possível copiar"),
    );
  }

  function insertVariableIntoDraft(v: string) {
    if (!draft) return;
    setDraft({ ...draft, title_template: draft.title_template + v });
  }

  return (
    <>
      <SistemaTopbar isAdmin />
      <div className="max-w-[1100px] mx-auto p-3 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <ListTodo className="h-6 w-6 text-indigo-600" />
          <div>
            <h2 className="text-xl font-semibold text-cocoa-900">
              Templates de tarefas
            </h2>
            <p className="text-sm text-cocoa-600">
              Modelos para criar tarefas rapidamente a partir do workbench.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="text-xs text-cocoa-600 hover:text-cocoa-900 underline-offset-2 hover:underline"
            >
              {showArchived ? "Ver activos" : "Ver arquivados"}
            </button>
            <Button onClick={openCreate} className="bg-cocoa-700 hover:bg-cocoa-800 text-cream-50">
              <Plus className="h-4 w-4 mr-1.5" />
              Novo template
            </Button>
          </div>
        </div>

        {/* Variáveis disponíveis — clicáveis para copiar */}
        <div className="rounded-lg border border-cream-200 bg-cream-50/50 p-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-cocoa-700">
            Variáveis disponíveis
          </p>
          <p className="text-[11px] text-cocoa-600">
            Click para copiar e cola no título do template. Variáveis sem valor na
            encomenda/vale ficam como <span className="font-mono">“—”</span>.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TASK_TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => copyVariable(v.key)}
                title={`${v.description} • Escopo: ${v.scope === "both" ? "ambos" : v.scope === "order" ? "só encomenda" : "só vale"}`}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface border border-cream-300 text-[11px] font-mono text-cocoa-800 hover:bg-cream-100 hover:border-cocoa-400 transition-colors"
              >
                {v.key}
                <Copy className="h-2.5 w-2.5 text-cocoa-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Lista de templates */}
        {/* overflow-x-auto + min-w: scroll horizontal no telemóvel em vez de
            esmagar as 7 colunas. No PC nada muda. */}
        <div className="rounded-lg border border-cream-200 bg-surface overflow-hidden overflow-x-auto">
          {visible.length === 0 ? (
            <p className="text-center text-sm text-cocoa-500 py-8">
              {showArchived
                ? "Sem templates arquivados."
                : "Sem templates. Carrega em + para criar um."}
            </p>
          ) : (
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-cream-50 text-[11px] uppercase tracking-wider text-cocoa-600">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Nome</th>
                  <th className="text-left px-3 py-2 font-semibold">Título</th>
                  <th className="text-left px-3 py-2 font-semibold">Escopo</th>
                  <th className="text-left px-3 py-2 font-semibold">Categoria</th>
                  <th className="text-left px-3 py-2 font-semibold">Prioridade</th>
                  <th className="text-center px-3 py-2 font-semibold">Valor</th>
                  <th className="text-right px-3 py-2 font-semibold">Acções</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-cream-100 hover:bg-cream-50/50"
                  >
                    <td className="px-3 py-2 font-medium text-cocoa-900">
                      <div className="flex items-center gap-1.5">
                        {t.is_seed && (
                          <span title="Template do seed inicial">
                            <Badge variant="outline" className="text-[9px] py-0 px-1 h-4 bg-amber-50 text-amber-700 border-amber-300">
                              Seed
                            </Badge>
                          </span>
                        )}
                        {t.name}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-cocoa-700 text-[12px] font-mono max-w-[280px] truncate" title={t.title_template}>
                      {t.title_template}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={`text-[10px] ${SCOPE_COLORS[t.scope]}`}>
                        {SCOPE_LABELS[t.scope]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-cocoa-700">
                      {TASK_CATEGORY_LABELS[t.default_category]}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-cocoa-700">
                      {TASK_PRIORITY_LABELS[t.default_priority]}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {t.needs_amount ? (
                        <span title={`Pede valor: ${t.amount_label ?? "Valor"}`}>
                          <Receipt className="inline h-4 w-4 text-emerald-600" />
                        </span>
                      ) : (
                        <span className="text-cocoa-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="p-1 rounded hover:bg-cream-100 text-cocoa-600 hover:text-cocoa-900"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {t.deleted_at ? (
                          <button
                            type="button"
                            onClick={() => handleRestore(t)}
                            className="p-1 rounded hover:bg-cream-100 text-cocoa-600 hover:text-emerald-700"
                            title="Restaurar"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleArchive(t)}
                            className="p-1 rounded hover:bg-cream-100 text-cocoa-600 hover:text-rose-700"
                            title={t.is_seed ? "Arquivar (não apaga; podes restaurar)" : "Arquivar"}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Editar template" : "Novo template"}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Ex.: Passar fatura com NIF"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Escopo</Label>
                  <Select
                    value={draft.scope}
                    onValueChange={(v) => setDraft({ ...draft, scope: v as TaskTemplateScope })}
                  >
                    <SelectTrigger>
                      <SelectValue labels={SCOPE_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SCOPE_LABELS) as TaskTemplateScope[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {SCOPE_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Título da tarefa (com variáveis)</Label>
                <Textarea
                  value={draft.title_template}
                  onChange={(e) => setDraft({ ...draft, title_template: e.target.value })}
                  placeholder="Ex.: Passar fatura para {nome_cliente} — NIF: {nif}"
                  rows={2}
                  className="font-mono text-[12px]"
                />
                <div className="flex flex-wrap gap-1">
                  {TASK_TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariableIntoDraft(v.key)}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cream-100 hover:bg-cream-200 text-[10px] font-mono text-cocoa-700 border border-cream-300"
                      title={v.description}
                    >
                      + {v.key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Descrição opcional (com variáveis)</Label>
                <Textarea
                  value={draft.description_template}
                  onChange={(e) => setDraft({ ...draft, description_template: e.target.value })}
                  placeholder="(opcional)"
                  rows={2}
                  className="font-mono text-[12px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Categoria default</Label>
                  <Select
                    value={draft.default_category}
                    onValueChange={(v) => setDraft({ ...draft, default_category: v as TaskCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue labels={TASK_CATEGORY_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TASK_CATEGORY_LABELS) as TaskCategory[]).map((c) => (
                        <SelectItem key={c} value={c}>
                          {TASK_CATEGORY_LABELS[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prioridade default</Label>
                  <Select
                    value={draft.default_priority}
                    onValueChange={(v) => setDraft({ ...draft, default_priority: v as TaskPriority })}
                  >
                    <SelectTrigger>
                      <SelectValue labels={TASK_PRIORITY_LABELS} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                        <SelectItem key={p} value={p}>
                          {TASK_PRIORITY_LABELS[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border border-cream-200 bg-cream-50/50 p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={draft.needs_amount}
                    onCheckedChange={(v) => setDraft({ ...draft, needs_amount: !!v })}
                  />
                  <span className="text-sm text-cocoa-900">
                    Este template pede um valor (€)
                  </span>
                </label>
                {draft.needs_amount && (
                  <div className="space-y-1.5 pl-6">
                    <Label className="text-xs">Etiqueta do diálogo</Label>
                    <Input
                      value={draft.amount_label}
                      onChange={(e) => setDraft({ ...draft, amount_label: e.target.value })}
                      placeholder='Ex.: "Valor a faturar"'
                    />
                    <p className="text-[10px] text-cocoa-500">
                      Ao criar a tarefa no workbench, abre um diálogo com este label
                      a pedir o valor. O resultado substitui <span className="font-mono">{"{valor}"}</span> no
                      título.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDraft(null)}
              disabled={pending}
            >
              <X className="h-4 w-4 mr-1.5" />
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={pending}
              className="bg-cocoa-700 hover:bg-cocoa-800 text-cream-50"
            >
              <Save className="h-4 w-4 mr-1.5" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
