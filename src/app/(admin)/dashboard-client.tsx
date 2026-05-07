"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Truck,
  Bell,
  ListTodo,
  Calendar as CalendarIcon,
  AlertTriangle,
  ChevronRight,
  Loader2,
  X,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { pt } from "date-fns/locale";
import { toast } from "sonner";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { Task, ChecklistItem, TaskPriority } from "@/types/tasks";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_ORDER,
} from "@/types/tasks";
import type { Role } from "@/lib/auth/roles";
import {
  PICKUP_KIND_LABELS,
  PICKUP_KIND_COLORS,
  type PickupItem,
  type DashboardAlert,
} from "@/lib/dashboard";
import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
  createChecklistItemAction,
  updateChecklistItemAction,
  deleteChecklistItemAction,
} from "./actions";

const TEAM_MEMBERS = [
  { email: "info+antonio@floresabeirario.pt", name: "António" },
  { email: "info+mj@floresabeirario.pt", name: "MJ" },
  { email: "info+ana@floresabeirario.pt", name: "Ana" },
];

function memberName(email: string | null | undefined): string {
  if (!email) return "—";
  return TEAM_MEMBERS.find((m) => m.email === email)?.name ?? email;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd/MM/yyyy", { locale: pt });
  } catch {
    return "—";
  }
}

function formatRelativeDays(d: string): string {
  const days = differenceInDays(parseISO(d), new Date());
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days === -1) return "Ontem";
  if (days > 0) return `Em ${days} dias`;
  return `Há ${Math.abs(days)} dias`;
}

interface Props {
  currentEmail: string;
  role: Role;
  tasks: Task[];
  checklist: ChecklistItem[];
  pickups: PickupItem[];
  alerts: DashboardAlert[];
}

export default function DashboardClient({
  currentEmail,
  role,
  tasks: initialTasks,
  checklist: initialChecklist,
  pickups,
  alerts,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialChecklist);

  // Para admins: pode ver checklist de outro utilizador
  const [viewingEmail, setViewingEmail] = useState<string>(currentEmail);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-[#C4A882]" />
        <div>
          <h1 className="text-2xl font-semibold text-[#3D2B1F] dark:text-[#E8D5B5]">
            Dashboard
          </h1>
          <p className="text-sm text-[#8B7355] dark:text-[#8E8E93]">
            Bem-vinda, {memberName(currentEmail)} 👋
          </p>
        </div>
        <div className="ml-auto">
          <Link
            href="/metricas"
            className="inline-flex items-center gap-2 rounded-lg border border-[#E8E0D5] dark:border-[#2C2C2E] bg-white dark:bg-[#141414] px-3 py-1.5 text-sm font-medium text-[#3D2B1F] dark:text-[#E8D5B5] hover:bg-[#FAF8F5] dark:hover:bg-[#2C2C2E] transition-colors"
          >
            Ver métricas
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Grid 2x2 (1 col em mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChecklistCard
          items={checklist}
          setItems={setChecklist}
          currentEmail={currentEmail}
          viewingEmail={viewingEmail}
          setViewingEmail={setViewingEmail}
          role={role}
        />
        <TasksCard
          tasks={tasks}
          setTasks={setTasks}
          currentEmail={currentEmail}
        />
        <PickupsCard pickups={pickups} />
        <AlertsCard alerts={alerts} />
      </div>
    </div>
  );
}

// ============================================================
// SecçãoBase: card com header + corpo
// ============================================================

function SectionCard({
  title,
  icon: Icon,
  iconColor,
  children,
  action,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E8E0D5] dark:border-[#2C2C2E] bg-white dark:bg-[#141414] overflow-hidden flex flex-col">
      <header className="flex items-center gap-2 px-5 py-3 border-b border-[#E8E0D5] dark:border-[#2C2C2E]">
        <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
        <h2 className="text-sm font-semibold text-[#3D2B1F] dark:text-[#E8D5B5] flex-1">
          {title}
        </h2>
        {action}
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </section>
  );
}

// ============================================================
// Checklist pessoal
// ============================================================

function ChecklistCard({
  items,
  setItems,
  currentEmail,
  viewingEmail,
  setViewingEmail,
  role,
}: {
  items: ChecklistItem[];
  setItems: React.Dispatch<React.SetStateAction<ChecklistItem[]>>;
  currentEmail: string;
  viewingEmail: string;
  setViewingEmail: (email: string) => void;
  role: Role;
}) {
  const [newText, setNewText] = useState("");
  const [pending, startTransition] = useTransition();

  // Só admin pode escolher checklist de outro
  const canSwitchOwner = role === "admin";
  // Só pode escrever na sua própria checklist
  const canWrite = viewingEmail === currentEmail;

  const visibleItems = useMemo(
    () =>
      items
        .filter((i) => i.owner_email === viewingEmail)
        .sort((a, b) => {
          // Concluídos no fim, depois por position
          if (a.done !== b.done) return a.done ? 1 : -1;
          return a.position - b.position;
        }),
    [items, viewingEmail],
  );

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
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, done: next } : i)),
    );
    startTransition(async () => {
      try {
        await updateChecklistItemAction(item.id, { done: next });
      } catch (err) {
        toast.error("Erro ao actualizar: " + (err as Error).message);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, done: item.done } : i)),
        );
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
          <Select value={viewingEmail} onValueChange={(v) => v && setViewingEmail(v as string)}>
            <SelectTrigger className="h-7 text-xs px-2 py-1 w-auto min-w-[120px]">
              <SelectValue
                labels={Object.fromEntries(
                  TEAM_MEMBERS.map((m) => [m.email, `Lista de ${m.name}`]),
                )}
              />
            </SelectTrigger>
            <SelectContent>
              {TEAM_MEMBERS.map((m) => (
                <SelectItem key={m.email} value={m.email}>
                  Lista de {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null
      }
    >
      <div className="px-5 py-4 space-y-1.5 max-h-[420px] overflow-y-auto">
        {visibleItems.length === 0 && (
          <p className="text-sm text-[#8B7355] dark:text-[#8E8E93] py-6 text-center">
            {canWrite
              ? "A tua lista está vazia. Acrescenta o primeiro item abaixo."
              : `${memberName(viewingEmail)} ainda não tem itens.`}
          </p>
        )}
        {visibleItems.map((item) => (
          <div
            key={item.id}
            className="group flex items-start gap-2 py-1 px-1 rounded-lg hover:bg-[#FAF8F5] dark:hover:bg-[#1F1F1F] transition-colors"
          >
            <button
              type="button"
              onClick={() => handleToggle(item)}
              disabled={!canWrite}
              className="mt-0.5 shrink-0 disabled:cursor-not-allowed"
              title={canWrite ? (item.done ? "Reabrir" : "Marcar como feito") : "Só leitura"}
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <Circle className="h-4 w-4 text-[#C4A882] group-hover:text-[#8B7355]" />
              )}
            </button>
            <span
              className={cn(
                "flex-1 text-sm leading-snug",
                item.done
                  ? "text-[#B8A99A] dark:text-[#6E6E73] line-through"
                  : "text-[#3D2B1F] dark:text-[#E8D5B5]",
              )}
            >
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
        ))}
      </div>

      {canWrite && (
        <form
          onSubmit={handleAdd}
          className="border-t border-[#E8E0D5] dark:border-[#2C2C2E] px-5 py-3 flex gap-2"
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

// ============================================================
// Afazeres globais (Tasks)
// ============================================================

function TasksCard({
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
  const [newAssignee, setNewAssignee] = useState<string>("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("media");
  const [newDueDate, setNewDueDate] = useState<string>("");

  const visibleTasks = useMemo(() => {
    let list = tasks;
    if (filter === "minhas") list = list.filter((t) => t.assignee_email === currentEmail);
    if (filter === "feitas") list = list.filter((t) => t.done);
    if (filter !== "feitas") list = list.filter((t) => !t.done);
    return list.sort((a, b) => {
      // Por prazo asc, depois prioridade asc, depois data de criação desc
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

  function resetNewForm() {
    setNewTitle("");
    setNewAssignee("");
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
        const created = await createTaskAction({
          title,
          assignee_email: newAssignee || null,
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
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: next } : t)),
    );
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { done: next });
      } catch (err) {
        toast.error("Erro: " + (err as Error).message);
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, done: task.done } : t)),
        );
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

  function handleAssigneeChange(task: Task, email: string | null) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, assignee_email: email } : t)),
    );
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { assignee_email: email });
      } catch (err) {
        toast.error("Erro: " + (err as Error).message);
      }
    });
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
              <SelectValue
                labels={{ todas: "Todas", minhas: "Minhas", feitas: "Feitas" }}
              />
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
          className="border-b border-[#E8E0D5] dark:border-[#2C2C2E] px-5 py-3 space-y-2 bg-[#FAF8F5] dark:bg-[#1A1A1A]"
        >
          <Input
            placeholder="Título da tarefa…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
          <div className="grid grid-cols-3 gap-2">
            <Select value={newAssignee} onValueChange={(v) => setNewAssignee((v as string) ?? "")}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue
                  placeholder="Atribuir a…"
                  labels={Object.fromEntries(TEAM_MEMBERS.map((m) => [m.email, m.name]))}
                />
              </SelectTrigger>
              <SelectContent>
                {TEAM_MEMBERS.map((m) => (
                  <SelectItem key={m.email} value={m.email}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <p className="text-sm text-[#8B7355] dark:text-[#8E8E93] py-6 text-center">
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
              className="group flex items-start gap-2 py-2 px-1 border-b border-[#F0EAE0] dark:border-[#1F1F1F] last:border-0"
            >
              <button
                type="button"
                onClick={() => handleToggle(task)}
                className="mt-0.5 shrink-0"
                title={task.done ? "Reabrir" : "Marcar como feita"}
              >
                {task.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-[#C4A882] hover:text-[#8B7355]" />
                )}
              </button>
              <div className="flex-1 min-w-0 space-y-1">
                <div
                  className={cn(
                    "text-sm leading-snug",
                    task.done
                      ? "text-[#B8A99A] dark:text-[#6E6E73] line-through"
                      : "text-[#3D2B1F] dark:text-[#E8D5B5]",
                  )}
                >
                  {task.title}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  {/* Assignee */}
                  <Select
                    value={task.assignee_email ?? "__none__"}
                    onValueChange={(v) =>
                      handleAssigneeChange(task, v === "__none__" ? null : (v as string))
                    }
                  >
                    <SelectTrigger className="h-5 px-1.5 py-0 text-[11px] w-auto min-w-0 gap-1">
                      <SelectValue
                        labels={{
                          __none__: "Sem responsável",
                          ...Object.fromEntries(TEAM_MEMBERS.map((m) => [m.email, m.name])),
                        }}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem responsável</SelectItem>
                      {TEAM_MEMBERS.map((m) => (
                        <SelectItem key={m.email} value={m.email}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Prioridade */}
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

                  {/* Prazo */}
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
    </SectionCard>
  );
}

// ============================================================
// Recolhas e entregas próximas
// ============================================================

function PickupsCard({ pickups }: { pickups: PickupItem[] }) {
  return (
    <SectionCard
      title="Recolhas e entregas (próximos 30 dias)"
      icon={Truck}
      iconColor="text-sky-600"
      action={
        <Link
          href="/entregas-recolhas"
          className="text-xs text-[#8B7355] hover:text-[#3D2B1F] dark:text-[#8E8E93] dark:hover:text-[#E8D5B5]"
        >
          Ver tudo →
        </Link>
      }
    >
      <div className="px-5 py-3 max-h-[420px] overflow-y-auto">
        {pickups.length === 0 && (
          <p className="text-sm text-[#8B7355] dark:text-[#8E8E93] py-6 text-center">
            Nada agendado nos próximos 30 dias.
          </p>
        )}
        <div className="space-y-2">
          {pickups.map((p) => (
            <Link
              key={`${p.order.id}-${p.kind}`}
              href={`/preservacao/${p.order.order_id ?? p.order.id}`}
              className="flex items-start gap-3 p-2.5 rounded-lg border border-[#F0EAE0] dark:border-[#1F1F1F] hover:border-[#E8E0D5] dark:hover:border-[#2C2C2E] hover:bg-[#FAF8F5] dark:hover:bg-[#1F1F1F] transition-colors"
            >
              <div className="shrink-0 text-center">
                <div className="text-xs font-semibold text-[#C4A882] uppercase">
                  {format(parseISO(p.date), "MMM", { locale: pt })}
                </div>
                <div className="text-lg font-semibold text-[#3D2B1F] dark:text-[#E8D5B5] leading-none">
                  {format(parseISO(p.date), "dd")}
                </div>
                <div className="text-[10px] text-[#8B7355] dark:text-[#8E8E93] uppercase">
                  {format(parseISO(p.date), "EEE", { locale: pt })}
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-sm font-medium text-[#3D2B1F] dark:text-[#E8D5B5] truncate">
                  {p.order.client_name}
                </div>
                <div className="text-xs text-[#8B7355] dark:text-[#8E8E93] truncate">
                  📍 {p.location}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-5 px-1.5 py-0 text-[10px] font-normal",
                      PICKUP_KIND_COLORS[p.kind],
                    )}
                  >
                    {PICKUP_KIND_LABELS[p.kind]}
                  </Badge>
                  <span className="text-[11px] text-[#8B7355] dark:text-[#8E8E93]">
                    {formatRelativeDays(p.date)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

// ============================================================
// Alertas
// ============================================================

const ALERT_STYLES: Record<DashboardAlert["severity"], string> = {
  info:   "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
  warn:   "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  danger: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
};

function AlertsCard({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <SectionCard
      title={`Alertas (${alerts.length})`}
      icon={Bell}
      iconColor="text-amber-600"
    >
      <div className="px-5 py-3 max-h-[420px] overflow-y-auto">
        {alerts.length === 0 && (
          <p className="text-sm text-[#8B7355] dark:text-[#8E8E93] py-6 text-center">
            Sem alertas. Tudo em dia ✨
          </p>
        )}
        <div className="space-y-2">
          {alerts.map((a) => {
            const Inner = (
              <div className={cn("flex items-start gap-3 p-2.5 rounded-lg border", ALERT_STYLES[a.severity])}>
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="text-sm font-semibold leading-snug">{a.label}</div>
                  <div className="text-xs opacity-80 leading-snug">{a.detail}</div>
                </div>
                {a.href && <ChevronRight className="h-4 w-4 mt-0.5 opacity-60 shrink-0" />}
              </div>
            );
            return a.href ? (
              <Link key={a.id} href={a.href} className="block">
                {Inner}
              </Link>
            ) : (
              <div key={a.id}>{Inner}</div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
