"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { differenceInDays, parseISO } from "date-fns";
import {
  CalendarDays as CalendarIcon,
  Check,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { Task, TaskPriority, ChecklistItem } from "@/types/tasks";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_ORDER,
} from "@/types/tasks";
import type { Role } from "@/lib/auth/roles";

import {
  createChecklistItemAction,
  updateChecklistItemAction,
  deleteChecklistItemAction,
  updateTaskAction,
} from "../../actions";

import { SectionCard } from "./section-card";
import { RecentDoneRow } from "./recent-done-row";
import { formatDate } from "./format-helpers";
import { TEAM_MEMBERS, memberName } from "./team-members";

type MergedItem =
  | { kind: "checklist"; id: string; item: ChecklistItem }
  | { kind: "task"; id: string; task: Task };

export function ChecklistCard({
  items,
  setItems,
  tasks,
  setTasks,
  currentEmail,
  viewingEmail,
  setViewingEmail,
  role,
}: {
  items: ChecklistItem[];
  setItems: React.Dispatch<React.SetStateAction<ChecklistItem[]>>;
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  currentEmail: string;
  viewingEmail: string;
  setViewingEmail: (email: string) => void;
  role: Role;
}) {
  const [pending, startTransition] = useTransition();

  const canSwitchOwner = role === "admin";
  const canWrite = viewingEmail === currentEmail;

  // Form da nova item (escondido por defeito, abre via "+")
  const [showNew, setShowNew] = useState(false);
  const [newText, setNewText] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("media");
  const [newDueDate, setNewDueDate] = useState<string>("");

  // Edição inline por item da checklist.
  const [editingId, setEditingId] = useState<string | null>(null);

  const visibleItems = useMemo<MergedItem[]>(() => {
    const ownChecklist: MergedItem[] = items
      .filter((i) => i.owner_email === viewingEmail && !i.done)
      .map((item) => ({ kind: "checklist" as const, id: item.id, item }));

    const assignedTasks: MergedItem[] = tasks
      .filter((t) => !t.done && t.assignee_emails.includes(viewingEmail))
      .map((task) => ({ kind: "task" as const, id: task.id, task }));

    return [...ownChecklist, ...assignedTasks].sort((a, b) => {
      const aDue = a.kind === "task" ? a.task.due_date : a.item.due_date;
      const bDue = b.kind === "task" ? b.task.due_date : b.item.due_date;
      if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;

      const aPri =
        a.kind === "task" ? a.task.priority : a.item.priority;
      const bPri =
        b.kind === "task" ? b.task.priority : b.item.priority;
      const priDiff = TASK_PRIORITY_ORDER[aPri] - TASK_PRIORITY_ORDER[bPri];
      if (priDiff !== 0) return priDiff;

      if (a.kind === "checklist" && b.kind === "checklist") {
        return a.item.position - b.item.position;
      }
      return 0;
    });
  }, [items, tasks, viewingEmail]);

  const recentDone = useMemo<MergedItem[]>(() => {
    const doneChecklist: MergedItem[] = items
      .filter((i) => i.owner_email === viewingEmail && i.done)
      .map((item) => ({ kind: "checklist" as const, id: item.id, item }));

    const doneTasks: MergedItem[] = tasks
      .filter((t) => t.done && t.assignee_emails.includes(viewingEmail))
      .map((task) => ({ kind: "task" as const, id: task.id, task }));

    const ts = (x: MergedItem): string =>
      x.kind === "checklist"
        ? (x.item.done_at ?? x.item.updated_at)
        : (x.task.done_at ?? x.task.updated_at);

    return [...doneChecklist, ...doneTasks]
      .sort((a, b) => ts(b).localeCompare(ts(a)))
      .slice(0, 10);
  }, [items, tasks, viewingEmail]);

  const [showDone, setShowDone] = useState(false);

  function resetNewForm() {
    setNewText("");
    setNewDescription("");
    setNewPriority("media");
    setNewDueDate("");
    setShowNew(false);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const text = newText.trim();
    if (!text || !canWrite) return;
    startTransition(async () => {
      try {
        const created = await createChecklistItemAction({
          owner_email: currentEmail,
          text,
          description: newDescription.trim() || null,
          priority: newPriority,
          due_date: newDueDate || null,
        });
        setItems((prev) => [...prev, created]);
        resetNewForm();
      } catch (err) {
        toast.error("Não consegui criar o item: " + (err as Error).message);
      }
    });
  }

  function handleToggle(item: ChecklistItem) {
    if (!canWrite) return;
    const next = !item.done;
    const previous = item.done;
    const optimisticNow = new Date().toISOString();
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, done: next, done_at: next ? optimisticNow : null } : i,
      ),
    );
    startTransition(async () => {
      try {
        await updateChecklistItemAction(item.id, { done: next });
      } catch (err) {
        toast.error("Erro ao actualizar: " + (err as Error).message);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, done: previous, done_at: item.done_at } : i,
          ),
        );
        return;
      }
      if (next) {
        toast.success(`Feita: “${item.text}”`, {
          duration: 5000,
          action: {
            label: "Anular",
            onClick: () => {
              setItems((prev) =>
                prev.map((i) =>
                  i.id === item.id ? { ...i, done: false, done_at: null } : i,
                ),
              );
              void updateChecklistItemAction(item.id, { done: false }).catch((e) =>
                toast.error("Erro ao anular: " + (e as Error).message),
              );
            },
          },
        });
      }
    });
  }

  function handleToggleTask(task: Task, nextDone: boolean = true) {
    const previous = task.done;
    const optimisticNow = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, done: nextDone, done_at: nextDone ? optimisticNow : null } : t,
      ),
    );
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { done: nextDone });
      } catch (err) {
        toast.error("Erro: " + (err as Error).message);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, done: previous, done_at: task.done_at } : t,
          ),
        );
        return;
      }
      if (nextDone) {
        toast.success(`Feita: “${task.title}”`, {
          duration: 5000,
          action: {
            label: "Anular",
            onClick: () => {
              setTasks((prev) =>
                prev.map((t) =>
                  t.id === task.id ? { ...t, done: false, done_at: null } : t,
                ),
              );
              void updateTaskAction(task.id, { done: false }).catch((e) =>
                toast.error("Erro ao anular: " + (e as Error).message),
              );
            },
          },
        });
      }
    });
  }

  function handleDelete(item: ChecklistItem) {
    if (!canWrite) return;
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    startTransition(async () => {
      try {
        await deleteChecklistItemAction(item.id);
      } catch (err) {
        toast.error("Erro ao apagar: " + (err as Error).message);
      }
    });
  }

  function handleEditSave(
    item: ChecklistItem,
    next: { text: string; description: string; priority: TaskPriority; due_date: string | null },
  ) {
    const trimmed = next.text.trim();
    if (!trimmed) {
      toast.error("O texto não pode ficar vazio.");
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              text: trimmed,
              description: next.description.trim() || null,
              priority: next.priority,
              due_date: next.due_date,
            }
          : i,
      ),
    );
    setEditingId(null);
    startTransition(async () => {
      try {
        await updateChecklistItemAction(item.id, {
          text: trimmed,
          description: next.description.trim() || null,
          priority: next.priority,
          due_date: next.due_date,
        });
      } catch (err) {
        toast.error("Erro ao guardar: " + (err as Error).message);
      }
    });
  }

  return (
    <SectionCard
      title="Checklist pessoal"
      icon={ListTodo}
      iconColor="text-emerald-600"
      action={
        <div className="flex items-center gap-1.5">
          {canSwitchOwner &&
            TEAM_MEMBERS.map((m) => {
              const active = m.email === viewingEmail;
              return (
                <button
                  key={m.email}
                  type="button"
                  onClick={() => setViewingEmail(m.email)}
                  title={`Lista de ${m.name}`}
                  aria-pressed={active}
                  className={cn(
                    "relative h-8 w-8 rounded-full overflow-hidden transition-all",
                    active
                      ? "ring-2 ring-emerald-600 ring-offset-2 ring-offset-white"
                      : "opacity-50 hover:opacity-100",
                  )}
                >
                  <Image
                    src={m.photo}
                    alt={m.name}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </button>
              );
            })}
          {canWrite && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowNew((s) => !s)}
              className="h-7 px-2"
              title="Novo item"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      }
    >
      {showNew && canWrite && (
        <form
          onSubmit={handleCreate}
          className="border-b border-cream-200 px-5 py-3 space-y-2 bg-cream-50"
        >
          <Input
            placeholder="Novo item…"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
          <Textarea
            placeholder="Detalhes (opcional)…"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="min-h-14 text-sm py-1.5"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select
              value={newPriority}
              onValueChange={(v) => v && setNewPriority(v as TaskPriority)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue labels={TASK_PRIORITY_LABELS} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TASK_PRIORITY_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={resetNewForm}
              className="h-7"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!newText.trim() || pending}
              className="h-7"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar"}
            </Button>
          </div>
        </form>
      )}

      <div className="px-5 py-4 space-y-1.5 max-h-[440px] overflow-y-auto">
        {visibleItems.length === 0 && (
          <p className="text-sm text-cocoa-700 py-6 text-center">
            {canWrite
              ? "A tua lista está vazia. Carrega em + para criar um item."
              : `${memberName(viewingEmail)} ainda não tem itens.`}
          </p>
        )}
        {visibleItems.map((entry) => {
          if (entry.kind === "checklist") {
            const item = entry.item;
            if (editingId === item.id && canWrite) {
              return (
                <ChecklistEditForm
                  key={`c-${item.id}`}
                  item={item}
                  onCancel={() => setEditingId(null)}
                  onSave={(next) => handleEditSave(item, next)}
                />
              );
            }
            const overdue = item.due_date
              ? differenceInDays(parseISO(item.due_date), new Date()) < 0
              : false;
            return (
              <div
                key={`c-${item.id}`}
                className="group flex items-start gap-2 py-1.5 px-1 rounded-lg hover:bg-cream-50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  disabled={!canWrite}
                  className="mt-0.5 shrink-0 disabled:cursor-not-allowed"
                  aria-label={canWrite ? "Marcar como feito" : "Só leitura"}
                  title={canWrite ? "Marcar como feito" : "Só leitura"}
                >
                  <Square
                    className="h-4 w-4 text-[#C4A882] group-hover:text-emerald-600 transition-colors"
                    strokeWidth={2}
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm leading-snug text-cocoa-900 font-medium">
                    {item.text}
                  </div>
                  {item.description && (
                    <div className="text-[12px] text-cocoa-600 leading-snug whitespace-pre-wrap mt-0.5">
                      {item.description}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] mt-1">
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-4 px-1.5 py-0 text-[10px] font-normal border",
                        TASK_PRIORITY_COLORS[item.priority],
                      )}
                    >
                      {TASK_PRIORITY_LABELS[item.priority]}
                    </Badge>
                    {item.due_date && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-4 px-1.5 py-0 text-[10px] font-normal",
                          overdue
                            ? "bg-rose-100 text-rose-800 border-rose-300"
                            : "bg-slate-100 text-slate-700 border-slate-300",
                        )}
                      >
                        <CalendarIcon className="h-2.5 w-2.5 mr-0.5" />
                        {formatDate(item.due_date)}
                      </Badge>
                    )}
                  </div>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingId(item.id)}
                      className="text-[#C4A882] hover:text-cocoa-700"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="text-[#C4A882] hover:text-rose-600"
                      title="Apagar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          }

          const task = entry.task;
          const overdue = task.due_date
            ? differenceInDays(parseISO(task.due_date), new Date()) < 0
            : false;
          const sharedWith = task.assignee_emails.filter((e) => e !== viewingEmail);
          return (
            <div
              key={`t-${task.id}`}
              className="group flex items-start gap-2 py-1.5 px-1 rounded-lg hover:bg-cream-50 transition-colors"
            >
              <button
                type="button"
                onClick={() => handleToggleTask(task, true)}
                className="mt-0.5 shrink-0"
                aria-label="Marcar tarefa como feita"
                title="Marcar como feita (some para todos os atribuídos)"
              >
                <Square
                  className="h-4 w-4 text-indigo-500 group-hover:text-emerald-600 transition-colors"
                  strokeWidth={2}
                />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm leading-snug text-cocoa-900 font-medium">
                  {task.title}
                </div>
                {task.description && (
                  <div className="text-[12px] text-cocoa-600 leading-snug whitespace-pre-wrap mt-0.5">
                    {task.description}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] mt-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-4 px-1.5 py-0 text-[10px] font-normal border",
                      TASK_PRIORITY_COLORS[task.priority],
                    )}
                  >
                    {TASK_PRIORITY_LABELS[task.priority]}
                  </Badge>
                  {task.due_date && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-4 px-1.5 py-0 text-[10px] font-normal",
                        overdue
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : "bg-slate-100 text-slate-700 border-slate-300",
                      )}
                    >
                      <CalendarIcon className="h-2.5 w-2.5 mr-0.5" />
                      {formatDate(task.due_date)}
                    </Badge>
                  )}
                  {sharedWith.length > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5"
                      title={`Partilhada com ${sharedWith.map(memberName).join(", ")}`}
                    >
                      {sharedWith.map((email) => {
                        const m = TEAM_MEMBERS.find((tm) => tm.email === email);
                        if (!m) return null;
                        return (
                          <span
                            key={email}
                            className="relative h-4 w-4 rounded-full overflow-hidden ring-1 ring-cream-200"
                            title={`Também atribuída a ${m.name}`}
                          >
                            <Image
                              src={m.photo}
                              alt={m.name}
                              fill
                              sizes="16px"
                              className="object-cover"
                            />
                          </span>
                        );
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {recentDone.length > 0 && (
        <div className="border-t border-cream-200">
          <button
            type="button"
            onClick={() => setShowDone((s) => !s)}
            className="w-full flex items-center gap-2 px-5 py-2 text-xs text-cocoa-700 hover:bg-cream-50 transition-colors"
            aria-expanded={showDone}
          >
            {showDone ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <span>Concluídas recentes ({recentDone.length})</span>
          </button>
          {showDone && (
            <div className="px-5 pb-3 space-y-1">
              {recentDone.map((entry) =>
                entry.kind === "checklist" ? (
                  <RecentDoneRow
                    key={`dc-${entry.item.id}`}
                    text={entry.item.text}
                    doneAt={entry.item.done_at}
                    onReopen={canWrite ? () => handleToggle(entry.item) : undefined}
                  />
                ) : (
                  <RecentDoneRow
                    key={`dt-${entry.task.id}`}
                    text={entry.task.title}
                    doneAt={entry.task.done_at}
                    onReopen={() => handleToggleTask(entry.task, false)}
                  />
                ),
              )}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ============================================================
// ChecklistEditForm — modo edição inline
// ============================================================

function ChecklistEditForm({
  item,
  onCancel,
  onSave,
}: {
  item: ChecklistItem;
  onCancel: () => void;
  onSave: (next: {
    text: string;
    description: string;
    priority: TaskPriority;
    due_date: string | null;
  }) => void;
}) {
  const [text, setText] = useState(item.text);
  const [description, setDescription] = useState(item.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(item.priority);
  const [dueDate, setDueDate] = useState<string>(item.due_date ?? "");

  return (
    <div className="rounded-lg border border-emerald-300 bg-cream-50 px-2 py-2 space-y-1.5">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Texto"
        className="h-8 text-sm"
        autoFocus
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Detalhes (opcional)"
        className="min-h-14 text-[12px] py-1.5 leading-snug"
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        <Select value={priority} onValueChange={(v) => v && setPriority(v as TaskPriority)}>
          <SelectTrigger
            className={cn(
              "h-6 px-1.5 py-0 text-[11px] w-auto min-w-0 gap-1 border",
              TASK_PRIORITY_COLORS[priority],
            )}
          >
            <SelectValue labels={TASK_PRIORITY_LABELS} />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TASK_PRIORITY_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-6 text-[11px] px-1.5 w-auto"
        />
      </div>
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-cocoa-500 hover:text-cocoa-700 p-1"
          title="Cancelar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              text,
              description,
              priority,
              due_date: dueDate || null,
            })
          }
          className="text-emerald-600 hover:text-emerald-700 p-1"
          title="Guardar"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
