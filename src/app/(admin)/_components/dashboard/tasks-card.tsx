"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { differenceInDays, parseISO } from "date-fns";
import {
  CalendarDays as CalendarIcon,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Loader2,
  Plus,
  Square,
  Trash2,
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
import { cn } from "@/lib/utils";

import type { Task, TaskPriority } from "@/types/tasks";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_ORDER,
} from "@/types/tasks";

import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
} from "../../actions";

import { SectionCard } from "./section-card";
import { RecentDoneRow } from "./recent-done-row";
import { formatDate } from "./format-helpers";
import { TEAM_MEMBERS } from "./team-members";

export function TasksCard({
  tasks,
  setTasks,
  currentEmail,
}: {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  currentEmail: string;
}) {
  const [filter, setFilter] = useState<"todas" | "minhas" | "feitas">("todas");
  const [showNew, setShowNew] = useState(false);
  const [pending, startTransition] = useTransition();

  // Form da nova tarefa
  const [newTitle, setNewTitle] = useState("");
  const [newAssignees, setNewAssignees] = useState<string[]>([]);
  const [newPriority, setNewPriority] = useState<TaskPriority>("media");
  const [newDueDate, setNewDueDate] = useState<string>("");

  const visibleTasks = useMemo(() => {
    let list = tasks;
    if (filter === "minhas") list = list.filter((t) => t.assignee_emails.includes(currentEmail));
    if (filter === "feitas") list = list.filter((t) => t.done);
    if (filter !== "feitas") list = list.filter((t) => !t.done);
    return list.sort((a, b) => {
      if (a.due_date && b.due_date && a.due_date !== b.due_date) {
        return a.due_date.localeCompare(b.due_date);
      }
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      const pri = TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority];
      if (pri !== 0) return pri;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [tasks, filter, currentEmail]);

  const recentDoneTasks = useMemo(() => {
    let list = tasks.filter((t) => t.done);
    if (filter === "minhas") {
      list = list.filter((t) => t.assignee_emails.includes(currentEmail));
    }
    return list
      .sort((a, b) =>
        (b.done_at ?? b.updated_at).localeCompare(a.done_at ?? a.updated_at),
      )
      .slice(0, 10);
  }, [tasks, filter, currentEmail]);

  const [showDoneTasks, setShowDoneTasks] = useState(false);

  function reopenTask(task: Task) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: false, done_at: null } : t)),
    );
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { done: false });
      } catch (err) {
        toast.error("Erro ao reabrir: " + (err as Error).message);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, done: true, done_at: task.done_at } : t,
          ),
        );
      }
    });
  }

  function resetNewForm() {
    setNewTitle("");
    setNewAssignees([]);
    setNewPriority("media");
    setNewDueDate("");
    setShowNew(false);
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    startTransition(async () => {
      try {
        const seenBy = newAssignees.includes(currentEmail) ? [currentEmail] : [];
        const created = await createTaskAction({
          title,
          assignee_emails: newAssignees,
          seen_by: seenBy,
          priority: newPriority,
          due_date: newDueDate || null,
        });
        setTasks((prev) => [created, ...prev]);
        resetNewForm();
      } catch (err) {
        toast.error("Erro ao criar tarefa: " + (err as Error).message);
      }
    });
  }

  function handleToggle(task: Task) {
    const next = !task.done;
    const previous = task.done;
    const optimisticNow = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, done: next, done_at: next ? optimisticNow : null } : t,
      ),
    );
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { done: next });
      } catch (err) {
        toast.error("Erro: " + (err as Error).message);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, done: previous, done_at: task.done_at } : t,
          ),
        );
        return;
      }
      if (next) {
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

  function handleDelete(task: Task) {
    if (!confirm("Apagar esta tarefa?")) return;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    startTransition(async () => {
      try {
        await deleteTaskAction(task.id);
      } catch (err) {
        toast.error("Erro ao apagar: " + (err as Error).message);
      }
    });
  }

  function handleAssigneesChange(task: Task, emails: string[]) {
    // Quando um assignee é removido, também sai do seen_by — não faz sentido
    // mantê-lo lá (se for re-atribuído mais tarde, deve voltar a notificá-lo).
    const seen_by = task.seen_by.filter((e) => emails.includes(e));
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, assignee_emails: emails, seen_by } : t,
      ),
    );
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { assignee_emails: emails, seen_by });
      } catch (err) {
        toast.error("Erro: " + (err as Error).message);
      }
    });
  }

  function toggleAssignee(task: Task, email: string) {
    const next = task.assignee_emails.includes(email)
      ? task.assignee_emails.filter((e) => e !== email)
      : [...task.assignee_emails, email];
    handleAssigneesChange(task, next);
  }

  function handlePriorityChange(task: Task, priority: TaskPriority) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, priority } : t)),
    );
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { priority });
      } catch (err) {
        toast.error("Erro: " + (err as Error).message);
      }
    });
  }

  return (
    <SectionCard
      title="Afazeres globais"
      icon={ListTodo}
      iconColor="text-violet-600"
      action={
        <div className="flex items-center gap-1">
          <Select value={filter} onValueChange={(v) => v && setFilter(v as typeof filter)}>
            <SelectTrigger className="h-7 text-xs px-2 py-1 w-auto min-w-[100px]">
              <SelectValue labels={{ todas: "Todas", minhas: "Minhas", feitas: "Feitas" }} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="minhas">Minhas</SelectItem>
              <SelectItem value="feitas">Feitas</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowNew((s) => !s)}
            className="h-7 px-2"
            title="Nova tarefa"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      }
    >
      {showNew && (
        <form
          onSubmit={handleCreate}
          className="border-b border-cream-200 px-5 py-3 space-y-2 bg-cream-50"
        >
          <Input
            placeholder="Título da tarefa…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-cocoa-700">Atribuir a:</span>
            {TEAM_MEMBERS.map((m) => {
              const active = newAssignees.includes(m.email);
              return (
                <button
                  key={m.email}
                  type="button"
                  onClick={() =>
                    setNewAssignees((prev) =>
                      prev.includes(m.email)
                        ? prev.filter((e) => e !== m.email)
                        : [...prev, m.email],
                    )
                  }
                  title={`${active ? "Tirar" : "Atribuir a"} ${m.name}`}
                  aria-pressed={active}
                  className={cn(
                    "relative h-7 w-7 rounded-full overflow-hidden transition-all",
                    active
                      ? "ring-2 ring-violet-600 ring-offset-1 ring-offset-cream-50"
                      : "opacity-40 hover:opacity-100",
                  )}
                >
                  <Image
                    src={m.photo}
                    alt={m.name}
                    fill
                    sizes="28px"
                    className="object-cover"
                  />
                </button>
              );
            })}
            <span className="text-[11px] text-cocoa-500 ml-auto">
              {newAssignees.length === 0
                ? "Sem responsável"
                : newAssignees.length === 1
                  ? "1 responsável"
                  : `${newAssignees.length} responsáveis (partilhada)`}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Select value={newPriority} onValueChange={(v) => v && setNewPriority(v as TaskPriority)}>
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
            <Button type="button" size="sm" variant="ghost" onClick={resetNewForm} className="h-7">
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!newTitle.trim() || pending} className="h-7">
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Criar"}
            </Button>
          </div>
        </form>
      )}

      <div className="px-5 py-3 space-y-2 max-h-[420px] overflow-y-auto">
        {visibleTasks.length === 0 && (
          <p className="text-sm text-cocoa-700 py-6 text-center">
            Sem tarefas {filter === "minhas" ? "atribuídas a ti" : filter === "feitas" ? "concluídas" : ""}.
          </p>
        )}
        {visibleTasks.map((task) => {
          const overdue =
            task.due_date && !task.done
              ? differenceInDays(parseISO(task.due_date), new Date()) < 0
              : false;
          return (
            <div
              key={task.id}
              className="group flex items-start gap-2 py-2 px-1 border-b border-cream-100 last:border-0"
            >
              <button
                type="button"
                onClick={() => handleToggle(task)}
                className="mt-0.5 shrink-0"
                aria-label={task.done ? "Reabrir" : "Marcar como feita"}
                title={task.done ? "Reabrir" : "Marcar como feita"}
              >
                {task.done ? (
                  <CheckSquare className="h-4 w-4 text-emerald-600" strokeWidth={2} />
                ) : (
                  <Square
                    className="h-4 w-4 text-[#C4A882] hover:text-emerald-600 transition-colors"
                    strokeWidth={2}
                  />
                )}
              </button>
              <div className="flex-1 min-w-0 space-y-1">
                <div
                  className={cn(
                    "text-sm leading-snug",
                    task.done
                      ? "text-cocoa-500 dark:text-[#6E6E73] line-through"
                      : "text-cocoa-900",
                  )}
                >
                  {task.title}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {/* Assignees (multi) — clicar num avatar adiciona/remove */}
                  <div className="flex items-center gap-0.5">
                    {TEAM_MEMBERS.map((m) => {
                      const active = task.assignee_emails.includes(m.email);
                      return (
                        <button
                          key={m.email}
                          type="button"
                          onClick={() => toggleAssignee(task, m.email)}
                          title={`${active ? "Tirar" : "Atribuir a"} ${m.name}`}
                          aria-pressed={active}
                          className={cn(
                            "relative h-5 w-5 rounded-full overflow-hidden transition-all",
                            active
                              ? "ring-1 ring-violet-600 ring-offset-1 ring-offset-surface"
                              : "opacity-30 hover:opacity-100",
                          )}
                        >
                          <Image
                            src={m.photo}
                            alt={m.name}
                            fill
                            sizes="20px"
                            className="object-cover"
                          />
                        </button>
                      );
                    })}
                  </div>

                  <Select
                    value={task.priority}
                    onValueChange={(v) => v && handlePriorityChange(task, v as TaskPriority)}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-5 px-1.5 py-0 text-[11px] w-auto min-w-0 gap-1 border",
                        TASK_PRIORITY_COLORS[task.priority],
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

                  {task.due_date && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "h-5 px-1.5 py-0 text-[11px] font-normal",
                        overdue
                          ? "bg-rose-100 text-rose-800 border-rose-300"
                          : "bg-slate-100 text-slate-700 border-slate-300",
                      )}
                    >
                      <CalendarIcon className="h-2.5 w-2.5 mr-0.5" />
                      {formatDate(task.due_date)}
                    </Badge>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(task)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-[#C4A882] hover:text-rose-600"
                title="Apagar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {filter !== "feitas" && recentDoneTasks.length > 0 && (
        <div className="border-t border-cream-200">
          <button
            type="button"
            onClick={() => setShowDoneTasks((s) => !s)}
            className="w-full flex items-center gap-2 px-5 py-2 text-xs text-cocoa-700 hover:bg-cream-50 transition-colors"
            aria-expanded={showDoneTasks}
          >
            {showDoneTasks ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <span>Concluídas recentes ({recentDoneTasks.length})</span>
          </button>
          {showDoneTasks && (
            <div className="px-5 pb-3 space-y-1">
              {recentDoneTasks.map((task) => (
                <RecentDoneRow
                  key={`dt-${task.id}`}
                  text={task.title}
                  doneAt={task.done_at}
                  onReopen={() => reopenTask(task)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
