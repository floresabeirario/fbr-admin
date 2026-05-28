"use client";

// Bloco de tarefas para o workbench. Usado tanto em Preservação como em
// Vale-Presente. Genérico via `link: { type: "order" | "voucher"; id }` e
// `paymentOptions: AmountOption[]` (calculadas pelo parent — encomenda
// usa 30/40/70/100% do orçamento; vale usa só o total).

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { pt } from "date-fns/locale";
import {
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Calendar as CalendarIcon,
  ListTodo,
  Receipt,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TEAM_MEMBERS, memberName } from "@/app/(admin)/_components/dashboard/team-members";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_ORDER,
  type Task,
  type TaskPriority,
  type TaskTemplate,
} from "@/types/tasks";
import { formatEUR } from "@/lib/format";
import { linkify } from "@/lib/linkify";
import {
  interpolateTaskTemplate,
  type AmountOption,
  type TaskTemplateContext,
} from "@/lib/task-templates";
import { createTaskAction, updateTaskAction, deleteTaskAction } from "@/app/(admin)/actions";

const PRIORITY_ABBREV: Record<TaskPriority, string> = {
  baixa: "BAIXA",
  media: "MÉD",
  alta: "ALTA",
  urgente: "URG",
};

export type WorkbenchTasksLink =
  | { type: "order"; id: string }
  | { type: "voucher"; id: string };

export default function WorkbenchTasksBlock({
  link,
  context,
  paymentOptions,
  templates,
  initialTasks,
  currentEmail,
  canEdit,
}: {
  link: WorkbenchTasksLink;
  context: TaskTemplateContext;
  /** Botões pré-calculados para o diálogo `needs_amount`. Vazio = só campo manual. */
  paymentOptions: AmountOption[];
  templates: TaskTemplate[];
  initialTasks: Task[];
  currentEmail: string;
  canEdit: boolean;
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [pending, startTransition] = useTransition();
  const [showPicker, setShowPicker] = useState(false);

  // Dois passos:
  //  1. amountDraft (set quando template tem needs_amount) — preenche o
  //     diálogo "Qual é o valor?" antes de abrir o form propriamente dito.
  //  2. draft — form inline com título + assignees + prioridade + data.
  //     Quando o template não tem needs_amount vamos directos para aqui.
  const [amountDraft, setAmountDraft] = useState<TaskTemplate | null>(null);
  const [draft, setDraft] = useState<{
    template: TaskTemplate | null;
    title: string;
    description: string;
    amount: number | null;
    assignees: string[];
    priority: TaskPriority;
    dueDate: string;
  } | null>(null);

  const visibleTasks = tasks
    .filter((t) => !t.done)
    .sort((a, b) => {
      const pri = TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority];
      if (pri !== 0) return pri;
      if (a.due_date && b.due_date && a.due_date !== b.due_date) {
        return a.due_date.localeCompare(b.due_date);
      }
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      return b.created_at.localeCompare(a.created_at);
    });

  function openTemplate(template: TaskTemplate | null) {
    setShowPicker(false);
    if (template?.needs_amount) {
      setAmountDraft(template);
      return;
    }
    const title = template
      ? interpolateTaskTemplate(template.title_template, context)
      : "";
    setDraft({
      template,
      title,
      description: "",
      amount: null,
      assignees: [currentEmail],
      priority: template?.default_priority ?? "media",
      dueDate: "",
    });
  }

  function confirmAmount(value: number) {
    if (!amountDraft) return;
    const ctxWithAmount = { ...context, amount: value };
    const title = interpolateTaskTemplate(amountDraft.title_template, ctxWithAmount);
    setDraft({
      template: amountDraft,
      title,
      description: "",
      amount: value,
      assignees: [currentEmail],
      priority: amountDraft.default_priority,
      dueDate: "",
    });
    setAmountDraft(null);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      toast.error("Título não pode ficar vazio");
      return;
    }
    if (draft.assignees.length === 0) {
      toast.error("Escolhe pelo menos um responsável");
      return;
    }
    startTransition(async () => {
      try {
        const seenBy = draft.assignees.includes(currentEmail) ? [currentEmail] : [];
        const created = await createTaskAction({
          title,
          description: draft.description.trim() || null,
          assignee_emails: draft.assignees,
          seen_by: seenBy,
          priority: draft.priority,
          category: draft.template?.default_category ?? "outros",
          due_date: draft.dueDate || null,
          order_id:   link.type === "order"   ? link.id : null,
          voucher_id: link.type === "voucher" ? link.id : null,
          amount: draft.amount,
        });
        setTasks((prev) => [created, ...prev]);
        setDraft(null);
        toast.success("Tarefa criada");
      } catch (err) {
        toast.error("Erro ao criar tarefa: " + (err as Error).message);
      }
    });
  }

  function toggleAssignee(email: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      assignees: draft.assignees.includes(email)
        ? draft.assignees.filter((e) => e !== email)
        : [...draft.assignees, email],
    });
  }

  function handleDone(task: Task) {
    const prevDone = task.done;
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !prevDone } : t)));
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { done: !prevDone });
      } catch (err) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: prevDone } : t)));
        toast.error("Erro: " + (err as Error).message);
      }
    });
  }

  function handleDelete(task: Task) {
    if (!confirm("Apagar esta tarefa?")) return;
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    startTransition(async () => {
      try {
        await deleteTaskAction(task.id);
      } catch (err) {
        setTasks(previous);
        toast.error("Erro a apagar: " + (err as Error).message);
      }
    });
  }

  const itemLabel = link.type === "voucher" ? "vale" : "encomenda";

  return (
    <>
      <div className="space-y-2">
        {visibleTasks.length > 0 && (
          <p className="text-[11px] text-cocoa-600">
            <span className="font-medium text-cocoa-900">{visibleTasks.length}</span>
            {visibleTasks.length === 1 ? " tarefa por fazer" : " tarefas por fazer"}
          </p>
        )}
        {visibleTasks.length === 0 && !draft && (
          <p className="text-[12px] text-cocoa-500 italic">
            Sem tarefas pendentes para {itemLabel === "vale" ? "este vale" : "esta encomenda"}.
          </p>
        )}

        {visibleTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            onDone={() => handleDone(task)}
            onDelete={() => handleDelete(task)}
            canEdit={canEdit}
          />
        ))}

        {draft && (
          <form
            onSubmit={handleCreate}
            className="rounded-md border border-cocoa-200 bg-cream-50/60 p-2.5 space-y-2"
          >
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-medium text-cocoa-700">
                {draft.template ? draft.template.name : "Nova tarefa"}
              </Label>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="text-cocoa-400 hover:text-cocoa-700"
                aria-label="Cancelar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <Input
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Título da tarefa"
              className="h-8 text-[12px]"
            />

            <Textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Descrição (opcional)"
              className="min-h-14 text-[12px] py-1.5"
            />

            {draft.amount != null && (
              <div className="flex items-center justify-between rounded bg-cream-100 px-2 py-1 text-[11px]">
                <span className="text-cocoa-700">Valor</span>
                <span className="font-medium tabular-nums text-cocoa-900">
                  {formatEUR(draft.amount)}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              {TEAM_MEMBERS.map((m) => {
                const active = draft.assignees.includes(m.email);
                return (
                  <button
                    key={m.email}
                    type="button"
                    onClick={() => toggleAssignee(m.email)}
                    title={`${active ? "Tirar" : "Atribuir a"} ${m.name}`}
                    className={
                      "relative h-7 w-7 rounded-full overflow-hidden border-2 transition-all " +
                      (active
                        ? "border-indigo-500 ring-2 ring-indigo-200"
                        : "border-cream-200 opacity-40 grayscale hover:opacity-70")
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.photo} alt={m.name} className="h-full w-full object-cover" />
                  </button>
                );
              })}
              <div className="ml-auto flex items-center gap-1">
                <Select
                  value={draft.priority}
                  onValueChange={(v) => setDraft({ ...draft, priority: v as TaskPriority })}
                >
                  <SelectTrigger
                    className={
                      "h-7 px-2 text-[11px] w-24 font-semibold border " +
                      TASK_PRIORITY_COLORS[draft.priority]
                    }
                  >
                    <SelectValue labels={TASK_PRIORITY_LABELS} />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                      <SelectItem key={p} value={p} className="my-0.5">
                        <span
                          className={
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border " +
                            TASK_PRIORITY_COLORS[p]
                          }
                        >
                          {TASK_PRIORITY_LABELS[p]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={draft.dueDate}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                  className="h-7 w-[120px] text-[11px]"
                />
              </div>
            </div>

            <div className="flex gap-1.5">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 h-7 rounded bg-cocoa-700 text-cream-50 text-[12px] font-medium hover:bg-cocoa-800 disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          </form>
        )}

        {canEdit && !draft && (
          <Popover open={showPicker} onOpenChange={setShowPicker}>
            <PopoverTrigger className="w-full flex items-center justify-center gap-1 h-7 rounded border border-dashed border-cocoa-300 text-[12px] text-cocoa-600 hover:bg-cream-50 hover:border-cocoa-400">
              <Plus className="h-3.5 w-3.5" />
              Nova tarefa
            </PopoverTrigger>
            <PopoverContent className="w-72 p-1" align="end">
              <button
                type="button"
                onClick={() => openTemplate(null)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] rounded hover:bg-cream-50 text-left"
              >
                <ListTodo className="h-3.5 w-3.5 text-cocoa-500" />
                <span>Tarefa em branco</span>
              </button>
              {templates.length > 0 && (
                <>
                  <div className="my-1 border-t border-cream-200" />
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openTemplate(t)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-[12px] rounded hover:bg-cream-50 text-left"
                    >
                      {t.needs_amount ? (
                        <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <ListTodo className="h-3.5 w-3.5 text-cocoa-500" />
                      )}
                      <span className="flex-1">{t.name}</span>
                    </button>
                  ))}
                </>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      <Dialog open={!!amountDraft} onOpenChange={(open) => !open && setAmountDraft(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cocoa-900">
              <Receipt className="h-4 w-4 text-emerald-600" />
              {amountDraft?.amount_label ?? "Valor"}
            </DialogTitle>
            <DialogDescription>
              {paymentOptions.length > 0
                ? "Escolhe um valor predefinido ou introduz outro manual."
                : "Introduz o valor manualmente."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {paymentOptions.length > 0 && (
              <div className={paymentOptions.length === 1 ? "grid grid-cols-1" : "grid grid-cols-2 gap-2"}>
                {paymentOptions.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => confirmAmount(opt.value)}
                    className="rounded-md border border-cream-300 bg-cream-50 hover:bg-cream-100 px-3 py-2 text-[12px] text-cocoa-800 transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <CustomAmountInput onConfirm={confirmAmount} />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setAmountDraft(null)}
              className="text-[12px] text-cocoa-600 hover:text-cocoa-900"
            >
              Cancelar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TaskRow({
  task,
  onDone,
  onDelete,
  canEdit,
}: {
  task: Task;
  onDone: () => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  const overdue = task.due_date ? task.due_date < todayISO() : false;
  return (
    <div className="group rounded-md border border-cream-200 bg-surface px-2 py-1.5 hover:border-cream-300 transition-colors">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onDone}
          className="mt-0.5 text-cocoa-400 hover:text-cocoa-700"
          aria-label="Marcar como feita"
          disabled={!canEdit}
        >
          {task.done ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-cocoa-900 leading-snug break-words">
            {task.title}
          </p>
          {task.description && (
            <p className="text-[11px] text-cocoa-600 leading-snug whitespace-pre-wrap mt-0.5 break-words">
              {linkify(task.description)}
            </p>
          )}
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            {task.assignee_emails.length > 0 && (
              <div className="flex -space-x-1">
                {task.assignee_emails.map((email) => {
                  const m = TEAM_MEMBERS.find((tm) => tm.email === email);
                  if (!m) return null;
                  return (
                    <div
                      key={email}
                      title={memberName(email)}
                      className="h-4 w-4 rounded-full overflow-hidden border border-surface"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.photo} alt={m.name} className="h-full w-full object-cover" />
                    </div>
                  );
                })}
              </div>
            )}
            <span
              className={
                "inline-flex items-center h-4 px-1 rounded text-[9px] font-bold border " +
                TASK_PRIORITY_COLORS[task.priority]
              }
            >
              {PRIORITY_ABBREV[task.priority]}
            </span>
            {task.due_date && (
              <span
                className={
                  "inline-flex items-center gap-0.5 text-[10px] " +
                  (overdue ? "text-rose-700" : "text-cocoa-500")
                }
              >
                <CalendarIcon className="h-3 w-3" />
                {format(parseISO(task.due_date), "dd/MM", { locale: pt })}
              </span>
            )}
          </div>
        </div>
        {/* Valor à direita — regra universal de € à direita */}
        {task.amount != null && (
          <span className="text-[12px] font-medium tabular-nums text-cocoa-900 mt-0.5 shrink-0">
            {formatEUR(task.amount)}
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 text-cocoa-400 hover:text-rose-600 transition-opacity"
            aria-label="Apagar tarefa"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function CustomAmountInput({ onConfirm }: { onConfirm: (value: number) => void }) {
  const [value, setValue] = useState("");
  const numeric = Number(value);
  const valid = value !== "" && !Number.isNaN(numeric) && numeric > 0;
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-cocoa-700">€</span>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Valor manual"
          className="pl-7 h-9"
        />
      </div>
      <button
        type="button"
        disabled={!valid}
        onClick={() => valid && onConfirm(numeric)}
        className="h-9 px-3 rounded-md bg-cocoa-700 text-cream-50 text-[12px] font-medium hover:bg-cocoa-800 disabled:opacity-40"
      >
        OK
      </button>
    </div>
  );
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
