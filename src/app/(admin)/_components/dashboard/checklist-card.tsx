"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { differenceInDays, parseISO } from "date-fns";
import {
  CalendarDays as CalendarIcon,
  ListTodo,
  Loader2,
  Plus,
  Square,
  Users,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { Task, ChecklistItem } from "@/types/tasks";
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

// Lista mesclada: itens da checklist pessoal + tarefas globais atribuídas a mim.
// Tarefas têm um badge "Global" e prioridade/prazo; o toggle de done chama
// updateTaskAction (Opção A — qualquer assignee marca = feita para todos).
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
  const [newText, setNewText] = useState("");
  const [pending, startTransition] = useTransition();

  const canSwitchOwner = role === "admin";
  const canWrite = viewingEmail === currentEmail;

  const visibleItems = useMemo<MergedItem[]>(() => {
    const ownChecklist: MergedItem[] = items
      .filter((i) => i.owner_email === viewingEmail && !i.done)
      .map((item) => ({ kind: "checklist" as const, id: item.id, item }));

    const assignedTasks: MergedItem[] = tasks
      .filter((t) => !t.done && t.assignee_emails.includes(viewingEmail))
      .map((task) => ({ kind: "task" as const, id: task.id, task }));

    return [...ownChecklist, ...assignedTasks].sort((a, b) => {
      const aDue = a.kind === "task" ? a.task.due_date : null;
      const bDue = b.kind === "task" ? b.task.due_date : null;
      if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;

      if (a.kind === "task" && b.kind === "task") {
        return TASK_PRIORITY_ORDER[a.task.priority] - TASK_PRIORITY_ORDER[b.task.priority];
      }
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

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const text = newText.trim();
    if (!text || !canWrite) return;
    setNewText("");
    startTransition(async () => {
      try {
        const created = await createChecklistItemAction({
          owner_email: currentEmail,
          text,
        });
        setItems((prev) => [...prev, created]);
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

  return (
    <SectionCard
      title="Checklist pessoal"
      icon={ListTodo}
      iconColor="text-emerald-600"
      action={
        canSwitchOwner ? (
          <div className="flex items-center gap-1.5">
            {TEAM_MEMBERS.map((m) => {
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
          </div>
        ) : null
      }
    >
      <div className="px-5 py-4 space-y-1.5 max-h-[420px] overflow-y-auto">
        {visibleItems.length === 0 && (
          <p className="text-sm text-cocoa-700 py-6 text-center">
            {canWrite
              ? "A tua lista está vazia. Acrescenta o primeiro item abaixo."
              : `${memberName(viewingEmail)} ainda não tem itens.`}
          </p>
        )}
        {visibleItems.map((entry) => {
          if (entry.kind === "checklist") {
            const item = entry.item;
            return (
              <div
                key={`c-${item.id}`}
                className="group flex items-start gap-2 py-1 px-1 rounded-lg hover:bg-cream-50 transition-colors"
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
                <span className="flex-1 text-sm leading-snug text-cocoa-900">
                  {item.text}
                </span>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[#C4A882] hover:text-rose-600"
                    title="Apagar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
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
              className="group flex items-start gap-2 py-1 px-1 rounded-lg hover:bg-cream-50 transition-colors"
            >
              <button
                type="button"
                onClick={() => handleToggleTask(task, true)}
                className="mt-0.5 shrink-0"
                aria-label="Marcar tarefa como feita"
                title="Marcar como feita (some para todos os atribuídos)"
              >
                <Square
                  className="h-4 w-4 text-violet-500 group-hover:text-emerald-600 transition-colors"
                  strokeWidth={2}
                />
              </button>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="text-sm leading-snug text-cocoa-900">{task.title}</div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <Badge
                    variant="outline"
                    className="h-4 px-1.5 py-0 text-[10px] font-normal bg-violet-50 text-violet-700 border-violet-200"
                  >
                    Global
                  </Badge>
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
                      className="inline-flex items-center gap-0.5 text-[10px] text-cocoa-700"
                      title={`Partilhada com ${sharedWith.map(memberName).join(", ")}`}
                    >
                      <Users className="h-3 w-3" />
                      +{sharedWith.length}
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
                    badge="Global"
                    onReopen={() => handleToggleTask(entry.task, false)}
                  />
                ),
              )}
            </div>
          )}
        </div>
      )}

      {canWrite && (
        <form
          onSubmit={handleAdd}
          className="border-t border-cream-200 px-5 py-3 flex gap-2"
        >
          <Input
            placeholder="Acrescentar item…"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!newText.trim() || pending}
            className="h-8 px-3"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </form>
      )}
    </SectionCard>
  );
}
