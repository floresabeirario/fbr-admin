"use client";

import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
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
  Users,
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
  markTasksSeenAction,
  createChecklistItemAction,
  updateChecklistItemAction,
  deleteChecklistItemAction,
} from "./actions";

const TEAM_MEMBERS = [
  { email: "info+antonio@floresabeirario.pt", name: "António", photo: "/userphotos/antonio.webp" },
  { email: "info+mj@floresabeirario.pt", name: "MJ", photo: "/userphotos/mj.webp" },
  { email: "info+ana@floresabeirario.pt", name: "Ana", photo: "/userphotos/ana.webp" },
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

  // ── Notificações: ao abrir o Dashboard, mostra toast com as tarefas
  // que me foram atribuídas e ainda não vi, e marca-as como vistas ──
  const seenOnMount = useRef(false);
  useEffect(() => {
    if (seenOnMount.current) return;
    seenOnMount.current = true;
    if (!currentEmail) return;

    const unseen = initialTasks.filter(
      (t) =>
        !t.done &&
        t.assignee_emails.includes(currentEmail) &&
        !t.seen_by.includes(currentEmail),
    );
    if (unseen.length === 0) return;

    const titles = unseen.slice(0, 2).map((t) => `“${t.title}”`).join(" e ");
    const extra = unseen.length > 2 ? ` (+${unseen.length - 2})` : "";
    toast(`Tens ${unseen.length} tarefa${unseen.length === 1 ? "" : "s"} nova${unseen.length === 1 ? "" : "s"}`, {
      description: titles + extra,
      icon: <Bell className="h-4 w-4 text-sky-600" />,
      duration: 6000,
    });

    // Marca como vistas server-side. Não actualizamos o estado local
    // porque o flag `seenOnMount.current` impede o toast de re-aparecer
    // nesta sessão, e o próximo SSR vem com seen_by já actualizado.
    // (ESLint react-hooks/set-state-in-effect — [[feedback_react_set_state_in_effect]].)
    void markTasksSeenAction(unseen.map((t) => t.id)).catch(() => {});
  }, [currentEmail, initialTasks]);

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-[#C4A882]" />
        <div>
          <h1 className="text-2xl font-semibold text-cocoa-900">
            Dashboard
          </h1>
          <p className="text-sm text-cocoa-700">
            Bem-vinda, {memberName(currentEmail)} 👋
          </p>
        </div>
        <div className="ml-auto">
          <Link
            href="/metricas"
            className="inline-flex items-center gap-2 rounded-lg border border-cream-200 bg-surface px-3 py-1.5 text-sm font-medium text-cocoa-900 hover:bg-cream-50 transition-colors"
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
          tasks={tasks}
          setTasks={setTasks}
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
    <section className="rounded-2xl border border-cream-200 bg-surface overflow-hidden flex flex-col">
      <header className="flex items-center gap-2 px-5 py-3 border-b border-cream-200">
        <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
        <h2 className="text-sm font-semibold text-cocoa-900 flex-1">
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

// Lista mesclada: itens da checklist pessoal + tarefas globais atribuídas a mim.
// Tarefas têm um badge "Global" e prioridade/prazo; o toggle de done chama
// updateTaskAction (Opção A — qualquer assignee marca = feita para todos).
type MergedItem =
  | { kind: "checklist"; id: string; item: ChecklistItem }
  | { kind: "task"; id: string; task: Task };

function ChecklistCard({
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

  // Só admin pode escolher checklist de outro
  const canSwitchOwner = role === "admin";
  // Só pode escrever na sua própria checklist
  const canWrite = viewingEmail === currentEmail;

  const visibleItems = useMemo<MergedItem[]>(() => {
    const ownChecklist: MergedItem[] = items
      .filter((i) => i.owner_email === viewingEmail)
      .map((item) => ({ kind: "checklist" as const, id: item.id, item }));

    // Tarefas atribuídas a este utilizador, ainda não concluídas.
    // (As concluídas saem da lista para a Maria não as ver para sempre.)
    const assignedTasks: MergedItem[] = tasks
      .filter((t) => !t.done && t.assignee_emails.includes(viewingEmail))
      .map((task) => ({ kind: "task" as const, id: task.id, task }));

    return [...ownChecklist, ...assignedTasks].sort((a, b) => {
      // Concluídos (só checklist; tarefas done já saíram) no fim
      const aDone = a.kind === "checklist" ? a.item.done : false;
      const bDone = b.kind === "checklist" ? b.item.done : false;
      if (aDone !== bDone) return aDone ? 1 : -1;

      // Tarefas com prazo no topo, por prazo asc, depois prioridade
      const aDue = a.kind === "task" ? a.task.due_date : null;
      const bDue = b.kind === "task" ? b.task.due_date : null;
      if (aDue && bDue && aDue !== bDue) return aDue.localeCompare(bDue);
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;

      if (a.kind === "task" && b.kind === "task") {
        return TASK_PRIORITY_ORDER[a.task.priority] - TASK_PRIORITY_ORDER[b.task.priority];
      }

      // Checklist por position
      if (a.kind === "checklist" && b.kind === "checklist") {
        return a.item.position - b.item.position;
      }
      return 0;
    });
  }, [items, tasks, viewingEmail]);

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

  // Opção A: qualquer assignee marca como feita = some para todos.
  // O toggle de tarefas funciona mesmo quando se está a ver a lista de
  // outro utilizador (admin) — porque tarefas globais não pertencem a
  // ninguém em específico.
  function handleToggleTask(task: Task) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, done: true } : t)),
    );
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { done: true });
      } catch (err) {
        toast.error("Erro: " + (err as Error).message);
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, done: false } : t)),
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
                  title={canWrite ? (item.done ? "Reabrir" : "Marcar como feito") : "Só leitura"}
                >
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Circle className="h-4 w-4 text-[#C4A882] group-hover:text-cocoa-700" />
                  )}
                </button>
                <span
                  className={cn(
                    "flex-1 text-sm leading-snug",
                    item.done
                      ? "text-cocoa-500 dark:text-[#6E6E73] line-through"
                      : "text-cocoa-900",
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
            );
          }

          // Tarefa global atribuída a este utilizador
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
                onClick={() => handleToggleTask(task)}
                className="mt-0.5 shrink-0"
                title="Marcar como feita (some para todos os atribuídos)"
              >
                <Circle className="h-4 w-4 text-violet-500 group-hover:text-violet-700" />
              </button>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="text-sm leading-snug text-cocoa-900">
                  {task.title}
                </div>
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
  const [newAssignees, setNewAssignees] = useState<string[]>([]);
  const [newPriority, setNewPriority] = useState<TaskPriority>("media");
  const [newDueDate, setNewDueDate] = useState<string>("");

  const visibleTasks = useMemo(() => {
    let list = tasks;
    if (filter === "minhas") list = list.filter((t) => t.assignee_emails.includes(currentEmail));
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
        // Quem cria já viu a tarefa — se está entre os assignees, marca como vista
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
                title={task.done ? "Reabrir" : "Marcar como feita"}
              >
                {task.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Circle className="h-4 w-4 text-[#C4A882] hover:text-cocoa-700" />
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
          className="text-xs text-cocoa-700 hover:text-cocoa-900"
        >
          Ver tudo →
        </Link>
      }
    >
      <div className="px-5 py-3 max-h-[420px] overflow-y-auto">
        {pickups.length === 0 && (
          <p className="text-sm text-cocoa-700 py-6 text-center">
            Nada agendado nos próximos 30 dias.
          </p>
        )}
        <div className="space-y-2">
          {pickups.map((p) => (
            <Link
              key={`${p.order.id}-${p.kind}`}
              href={`/preservacao/${p.order.order_id ?? p.order.id}`}
              className="flex items-start gap-3 p-2.5 rounded-lg border border-cream-100 hover:border-cream-200 hover:bg-cream-50 transition-colors"
            >
              <div className="shrink-0 text-center">
                <div className="text-xs font-semibold text-[#C4A882] uppercase">
                  {format(parseISO(p.date), "MMM", { locale: pt })}
                </div>
                <div className="text-lg font-semibold text-cocoa-900 leading-none">
                  {format(parseISO(p.date), "dd")}
                </div>
                <div className="text-[10px] text-cocoa-700 uppercase">
                  {format(parseISO(p.date), "EEE", { locale: pt })}
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-sm font-medium text-cocoa-900 truncate">
                  {p.order.client_name}
                </div>
                <div className="text-xs text-cocoa-700 truncate">
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
                  <span className="text-[11px] text-cocoa-700">
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
          <p className="text-sm text-cocoa-700 py-6 text-center">
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
