"use client";

import {
  useMemo,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { differenceInDays, parseISO } from "date-fns";
import {
  CalendarDays as CalendarIcon,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FileText,
  Flower2,
  Globe,
  Link2,
  ListTodo,
  Loader2,
  MoreHorizontal,
  Package,
  Palette,
  Pencil,
  Plus,
  Square,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { formatEUR } from "@/lib/format";
import { linkify } from "@/lib/linkify";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type {
  Task,
  TaskCategory,
  TaskPriority,
  TaskStatus,
} from "@/types/tasks";
import {
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_ORDER,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_LABELS,
  TASK_STATUS_SHORT,
  TASK_STATUS_COLORS,
  TASK_STATUS_DOT_COLOR,
  TASK_STATUS_ORDER,
} from "@/types/tasks";

import {
  createTaskAction,
  updateTaskAction,
  deleteTaskAction,
} from "../../actions";

import { SectionCard } from "./section-card";
import { RecentDoneRow } from "./recent-done-row";
import {
  formatDate,
  formatCreatedAgo,
  formatReminder,
  reminderIsoToInput,
  reminderInputToIso,
} from "./format-helpers";
import { TEAM_MEMBERS } from "./team-members";

// Mobile = sm- (<640px). Usado para desactivar DnD e mudar layout para
// scroll horizontal com snap. useSyncExternalStore para subscrever ao
// matchMedia sem hydration mismatch e sem setState-em-useEffect.
function useIsMobile(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(max-width: 639px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(max-width: 639px)").matches,
    () => false,
  );
}

// Identidade visual por categoria — ícone distinto + barra colorida no topo
// da coluna + tom claro de fundo. Não usamos pills coloridos porque (i) ficavam
// indistinguíveis das outras pills da app, e (ii) o cabeçalho fica mais limpo
// com ícone + texto.
//
// Estúdio = atelier / materiais para trabalho do dia-a-dia → Palette + lime
// (purple confundia-se com o violet das Recolhas no local).
const CATEGORY_META: Record<
  TaskCategory,
  {
    icon: LucideIcon;
    topBorder: string;
    iconBg: string;
    iconColor: string;
    columnTint: string;
    leftAccent: string;
  }
> = {
  packaging: {
    icon: Package,
    topBorder: "border-t-orange-500",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-600",
    columnTint: "from-orange-50/40",
    leftAccent: "border-l-orange-400",
  },
  flores: {
    icon: Flower2,
    topBorder: "border-t-pink-500",
    iconBg: "bg-pink-100",
    iconColor: "text-pink-600",
    columnTint: "from-pink-50/40",
    leftAccent: "border-l-pink-400",
  },
  presenca_online: {
    icon: Globe,
    topBorder: "border-t-cyan-500",
    iconBg: "bg-cyan-100",
    iconColor: "text-cyan-700",
    columnTint: "from-cyan-50/40",
    leftAccent: "border-l-cyan-400",
  },
  estudio: {
    icon: Palette,
    topBorder: "border-t-lime-500",
    iconBg: "bg-lime-100",
    iconColor: "text-lime-700",
    columnTint: "from-lime-50/40",
    leftAccent: "border-l-lime-400",
  },
  administrativo: {
    icon: FileText,
    topBorder: "border-t-teal-600",
    iconBg: "bg-teal-100",
    iconColor: "text-teal-700",
    columnTint: "from-teal-50/40",
    leftAccent: "border-l-teal-500",
  },
  outros: {
    icon: MoreHorizontal,
    topBorder: "border-t-stone-300",
    iconBg: "bg-stone-100",
    iconColor: "text-stone-500",
    columnTint: "from-stone-50/30",
    leftAccent: "border-l-stone-200",
  },
};

const DEFAULT_CATEGORY_ORDER = (
  Object.keys(TASK_CATEGORY_LABELS) as TaskCategory[]
).sort((a, b) => TASK_CATEGORY_ORDER[a] - TASK_CATEGORY_ORDER[b]);

const COLUMN_ORDER_STORAGE_KEY = "fbr.dashboard.tasksColumnOrder.v1";

// Pill compacto de prioridade — substitui o Select inline (que ocupava muito
// espaço) e o pontinho (não era explícito). Abreviatura curta, cor distinta,
// click abre popover. Cores reutilizam TASK_PRIORITY_COLORS para coerência
// com o resto da app (workbench Preservação, etc.).
const PRIORITY_ABBREV: Record<TaskPriority, string> = {
  baixa: "BAIXA",
  media: "MÉD",
  alta: "ALTA",
  urgente: "URG",
};

// Bola pequena usada dentro do popover (item da lista) para reforçar a cor.
const PRIORITY_DOT_COLOR: Record<TaskPriority, string> = {
  baixa: "bg-slate-300",
  media: "bg-sky-500",
  alta: "bg-amber-500",
  urgente: "bg-rose-500",
};

function parseStoredOrder(raw: string | null): TaskCategory[] {
  try {
    if (!raw) return DEFAULT_CATEGORY_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_CATEGORY_ORDER;
    const filtered = parsed.filter((c): c is TaskCategory =>
      DEFAULT_CATEGORY_ORDER.includes(c as TaskCategory),
    );
    // Completar com as que não estão no storage (ex.: categoria nova num release futuro)
    for (const c of DEFAULT_CATEGORY_ORDER) {
      if (!filtered.includes(c)) filtered.push(c);
    }
    return filtered.length === DEFAULT_CATEGORY_ORDER.length
      ? filtered
      : DEFAULT_CATEGORY_ORDER;
  } catch {
    return DEFAULT_CATEGORY_ORDER;
  }
}

// Snapshot cacheado por valor cru do localStorage — useSyncExternalStore exige
// referência estável quando nada mudou (React #185).
let orderCacheRaw: string | null | undefined = undefined;
let orderCacheValue: TaskCategory[] = DEFAULT_CATEGORY_ORDER;

function getStoredOrderSnapshot(): TaskCategory[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(COLUMN_ORDER_STORAGE_KEY);
  } catch {
    // privacy mode / quota — usa default
  }
  if (raw !== orderCacheRaw) {
    orderCacheRaw = raw;
    orderCacheValue = parseStoredOrder(raw);
  }
  return orderCacheValue;
}

const orderListeners = new Set<() => void>();

function subscribeStoredOrder(cb: () => void) {
  orderListeners.add(cb);
  // "storage" dispara quando outra aba altera o localStorage.
  window.addEventListener("storage", cb);
  return () => {
    orderListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function setStoredOrder(updater: (prev: TaskCategory[]) => TaskCategory[]) {
  const next = updater(getStoredOrderSnapshot());
  try {
    window.localStorage.setItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / privacy mode — ignorar */
  }
  orderListeners.forEach((cb) => cb());
}

export function TasksCard({
  tasks,
  setTasks,
  currentEmail,
  orderCodeById = {},
  orderClientById = {},
  voucherCodeById = {},
  voucherSenderById = {},
}: {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  currentEmail: string;
  /** uuid → código curto da encomenda (usado no href). */
  orderCodeById?: Record<string, string>;
  /** uuid → nome do cliente (usado no display do chip). */
  orderClientById?: Record<string, string>;
  /** uuid → código do vale (href). */
  voucherCodeById?: Record<string, string>;
  /** uuid → nome do remetente do vale (display). */
  voucherSenderById?: Record<string, string>;
}) {
  // Filtro por membro — 3 avatares no topo. Default: só as tarefas de quem
  // fez login (clicar nos avatares alarga/alterna). Tarefas sem responsável
  // aparecem sempre — são de todos, senão perdiam-se com o filtro activo.
  const [selectedMembers, setSelectedMembers] = useState<string[]>(() => {
    const isMember = TEAM_MEMBERS.some((m) => m.email === currentEmail);
    return isMember ? [currentEmail] : TEAM_MEMBERS.map((m) => m.email);
  });
  // Estado independente: mostrar concluídas ou activas?
  const [viewDone, setViewDone] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pending, startTransition] = useTransition();
  const isMobile = useIsMobile();

  const allMembersSelected =
    selectedMembers.length === TEAM_MEMBERS.length;

  function toggleMember(email: string) {
    setSelectedMembers((prev) =>
      prev.includes(email)
        ? prev.filter((e) => e !== email)
        : [...prev, email],
    );
  }

  // Ordem das colunas — persistida em localStorage (preferência por browser).
  // useSyncExternalStore: servidor usa a ordem default, cliente lê o storage
  // (sem setState em effect, sem hydration mismatch).
  const columnOrder = useSyncExternalStore(
    subscribeStoredOrder,
    getStoredOrderSnapshot,
    () => DEFAULT_CATEGORY_ORDER,
  );

  // Form da nova tarefa
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAssignees, setNewAssignees] = useState<string[]>([]);
  const [newPriority, setNewPriority] = useState<TaskPriority>("media");
  const [newCategory, setNewCategory] = useState<TaskCategory>("outros");
  const [newStatus, setNewStatus] = useState<TaskStatus>("por_comecar");
  const [newDueDate, setNewDueDate] = useState<string>("");
  const [newReminderAt, setNewReminderAt] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);

  // DnD — partilhado por tasks (mover entre colunas) e por reordenação de colunas.
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const [draggingColumn, setDraggingColumn] = useState<TaskCategory | null>(
    null,
  );
  // No mobile, exigir distância de 9999px torna o drag impossível (mas
  // mantém a árvore de DnD consistente para evitar mismatch de hooks).
  // O scroll vertical/horizontal passa a funcionar sempre.
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: isMobile ? 9999 : 6 },
    }),
    useSensor(KeyboardSensor),
  );
  const collisionDetection: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    return pointer.length > 0 ? pointer : rectIntersection(args);
  };

  const visibleTasks = useMemo(() => {
    let list = tasks;
    list = list.filter((t) => (viewDone ? t.done : !t.done));
    // Filtro por membro só se aplica quando há subset (não default).
    // Tarefas sem responsável passam sempre (pertencem a todos).
    if (!allMembersSelected) {
      list = list.filter(
        (t) =>
          t.assignee_emails.length === 0 ||
          t.assignee_emails.some((e) => selectedMembers.includes(e)),
      );
    }
    return list.sort((a, b) => {
      // Estado é o sinal mais forte: "em curso" e "hoje" sobem ao topo.
      const st = TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status];
      if (st !== 0) return st;
      if (a.due_date && b.due_date && a.due_date !== b.due_date) {
        return a.due_date.localeCompare(b.due_date);
      }
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;
      const pri =
        TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority];
      if (pri !== 0) return pri;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [tasks, viewDone, allMembersSelected, selectedMembers]);

  const tasksByCategory = useMemo(() => {
    const map: Record<TaskCategory, Task[]> = {
      packaging: [],
      flores: [],
      presenca_online: [],
      estudio: [],
      administrativo: [],
      outros: [],
    };
    for (const t of visibleTasks) {
      const cat = (t.category ?? "outros") as TaskCategory;
      map[cat].push(t);
    }
    return map;
  }, [visibleTasks]);

  const recentDoneTasks = useMemo(() => {
    let list = tasks.filter((t) => t.done);
    if (!allMembersSelected) {
      list = list.filter(
        (t) =>
          t.assignee_emails.length === 0 ||
          t.assignee_emails.some((e) => selectedMembers.includes(e)),
      );
    }
    return list
      .sort((a, b) =>
        (b.done_at ?? b.updated_at).localeCompare(a.done_at ?? a.updated_at),
      )
      .slice(0, 10);
  }, [tasks, allMembersSelected, selectedMembers]);

  const [showDoneTasks, setShowDoneTasks] = useState(false);

  function reopenTask(task: Task) {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, done: false, done_at: null } : t,
      ),
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
    setNewDescription("");
    setNewAssignees([]);
    setNewPriority("media");
    setNewCategory("outros");
    setNewStatus("por_comecar");
    setNewDueDate("");
    setNewReminderAt("");
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
          description: newDescription.trim() || null,
          assignee_emails: newAssignees,
          seen_by: seenBy,
          priority: newPriority,
          category: newCategory,
          status: newStatus,
          due_date: newDueDate || null,
          reminder_at: reminderInputToIso(newReminderAt),
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
        t.id === task.id
          ? { ...t, done: next, done_at: next ? optimisticNow : null }
          : t,
      ),
    );
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { done: next });
      } catch (err) {
        toast.error("Erro: " + (err as Error).message);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, done: previous, done_at: task.done_at }
              : t,
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

  function handleStatusChange(task: Task, status: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status } : t)),
    );
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { status });
      } catch (err) {
        toast.error("Erro: " + (err as Error).message);
      }
    });
  }

  function handleCategoryChange(task: Task, category: TaskCategory) {
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, category } : t)),
    );
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, { category });
      } catch (err) {
        toast.error("Erro: " + (err as Error).message);
      }
    });
  }

  function handleEditSave(
    task: Task,
    next: {
      title: string;
      description: string;
      category: TaskCategory;
      status: TaskStatus;
      priority: TaskPriority;
      due_date: string | null;
      reminder_at: string | null;
      assignee_emails: string[];
    },
  ) {
    const trimmed = next.title.trim();
    if (!trimmed) {
      toast.error("O título não pode ficar vazio.");
      return;
    }
    // Manter seen_by alinhado com assignees (perde quem já não é assignee).
    const seen_by = task.seen_by.filter((e) => next.assignee_emails.includes(e));
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              title: trimmed,
              description: next.description.trim() || null,
              category: next.category,
              status: next.status,
              priority: next.priority,
              due_date: next.due_date,
              reminder_at: next.reminder_at,
              assignee_emails: next.assignee_emails,
              seen_by,
            }
          : t,
      ),
    );
    setEditingId(null);
    startTransition(async () => {
      try {
        await updateTaskAction(task.id, {
          title: trimmed,
          description: next.description.trim() || null,
          category: next.category,
          status: next.status,
          priority: next.priority,
          due_date: next.due_date,
          reminder_at: next.reminder_at,
          assignee_emails: next.assignee_emails,
          seen_by,
        });
      } catch (err) {
        toast.error("Erro ao guardar: " + (err as Error).message);
      }
    });
  }

  function reorderColumn(from: TaskCategory, to: TaskCategory) {
    if (from === to) return;
    setStoredOrder((prev) => {
      const i = prev.indexOf(from);
      const j = prev.indexOf(to);
      if (i === -1 || j === -1) return prev;
      const next = [...prev];
      next.splice(i, 1);
      next.splice(j, 0, from);
      return next;
    });
  }

  // DnD handlers (tasks + columns)
  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as
      | { type: "task"; task: Task }
      | { type: "column"; category: TaskCategory }
      | undefined;
    if (data?.type === "task") setDraggingTask(data.task);
    if (data?.type === "column") setDraggingColumn(data.category);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeData = event.active.data.current as
      | { type: "task"; task: Task }
      | { type: "column"; category: TaskCategory }
      | undefined;
    setDraggingTask(null);
    setDraggingColumn(null);

    const { over } = event;
    if (!activeData || !over) return;
    const overId = String(over.id);

    if (activeData.type === "task") {
      if (!(overId in CATEGORY_META)) return;
      const target = overId as TaskCategory;
      if (target === activeData.task.category) return;
      handleCategoryChange(activeData.task, target);
      return;
    }

    if (activeData.type === "column") {
      if (!(overId in CATEGORY_META)) return;
      reorderColumn(activeData.category, overId as TaskCategory);
    }
  }

  return (
    <SectionCard
      title="Afazeres globais"
      icon={ListTodo}
      iconColor="text-indigo-600"
      action={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1" title="Filtrar por responsável (clica para esconder)">
            {TEAM_MEMBERS.map((m) => {
              const active = selectedMembers.includes(m.email);
              return (
                <button
                  key={m.email}
                  type="button"
                  onClick={() => toggleMember(m.email)}
                  aria-pressed={active}
                  title={
                    active
                      ? `Esconder tarefas de ${m.name}`
                      : `Mostrar tarefas de ${m.name}`
                  }
                  className={cn(
                    "relative h-7 w-7 rounded-full overflow-hidden transition-all shrink-0",
                    active
                      ? "ring-2 ring-indigo-600 ring-offset-1 ring-offset-surface"
                      : "opacity-30 grayscale hover:opacity-70",
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
          </div>
          <Button
            size="sm"
            variant={viewDone ? "default" : "ghost"}
            onClick={() => setViewDone((v) => !v)}
            className="h-7 px-2 text-xs"
            title={viewDone ? "Ver activas" : "Ver concluídas"}
          >
            {viewDone ? "Activas" : "Concluídas"}
          </Button>
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
          <Textarea
            placeholder="Detalhes (opcional)…"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="min-h-14 text-sm py-1.5"
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
                      ? "ring-2 ring-indigo-600 ring-offset-1 ring-offset-cream-50"
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Select
              value={newCategory}
              onValueChange={(v) => v && setNewCategory(v as TaskCategory)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue labels={TASK_CATEGORY_LABELS} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TASK_CATEGORY_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={newStatus}
              onValueChange={(v) => v && setNewStatus(v as TaskStatus)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue labels={TASK_STATUS_LABELS} />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TASK_STATUS_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <div className="flex items-center gap-2">
            <Label className="text-[11px] text-cocoa-600 shrink-0 flex items-center gap-1">
              🔔 Lembrar-me
            </Label>
            <Input
              type="datetime-local"
              value={newReminderAt}
              onChange={(e) => setNewReminderAt(e.target.value)}
              className="h-8 text-xs"
              title="Recebes uma notificação no telemóvel a esta data e hora"
            />
            {newReminderAt && (
              <button
                type="button"
                onClick={() => setNewReminderAt("")}
                className="text-[11px] text-cocoa-500 hover:text-rose-600 shrink-0"
                title="Remover lembrete"
              >
                limpar
              </button>
            )}
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
              disabled={!newTitle.trim() || pending}
              className="h-7"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Criar"
              )}
            </Button>
          </div>
        </form>
      )}

      <TaskEditDialog
        task={tasks.find((t) => t.id === editingId) ?? null}
        onClose={() => setEditingId(null)}
        onSave={(t, next) => handleEditSave(t, next)}
        onDelete={(t) => {
          setEditingId(null);
          handleDelete(t);
        }}
      />

      {visibleTasks.length === 0 ? (
        <div className="px-5 py-3">
          <p className="text-sm text-cocoa-700 py-6 text-center">
            {selectedMembers.length === 0
              ? "Nenhum responsável selecionado."
              : viewDone
                ? "Sem tarefas concluídas."
                : !allMembersSelected
                  ? "Sem tarefas para os responsáveis seleccionados."
                  : "Sem tarefas."}
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setDraggingTask(null);
            setDraggingColumn(null);
          }}
        >
          <div
            className={cn(
              // Mobile: flex horizontal com snap por coluna (~85vw cada).
              // -mx-5 + px-5 = "edge bleed" para que o scroll vá até às
              // margens do card sem deixar paddings vazios visíveis.
              // PC: flex (NÃO grid) para que cada coluna ganhe largura
              // proporcional ao seu conteúdo — vazias colapsam para ~110px
              // (só cabeçalho com ícone e contagem) e as com tarefas
              // partilham o espaço restante em partes iguais (flex-1).
              "flex gap-3 overflow-x-auto -mx-5 px-5 pb-3 snap-x snap-mandatory scroll-smooth",
              "sm:overflow-visible sm:mx-0 sm:px-5 sm:py-3 sm:snap-none sm:items-start",
            )}
          >
            {columnOrder.map((category) => (
              <CategoryColumn
                key={category}
                category={category}
                tasks={tasksByCategory[category]}
                setEditingId={setEditingId}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onToggleAssignee={toggleAssignee}
                onChangePriority={handlePriorityChange}
                onChangeStatus={handleStatusChange}
                draggingTaskId={draggingTask?.id ?? null}
                draggingColumn={draggingColumn}
                orderCodeById={orderCodeById}
                orderClientById={orderClientById}
                voucherCodeById={voucherCodeById}
                voucherSenderById={voucherSenderById}
                isMobile={isMobile}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {draggingTask && (
              <div className="rounded-md border border-cocoa-500 bg-surface shadow-xl px-2 py-1.5 max-w-[220px] cursor-grabbing">
                <div className="text-[12px] font-semibold text-cocoa-900 truncate">
                  {draggingTask.title}
                </div>
                {draggingTask.description && (
                  <div className="text-[10px] text-cocoa-600 truncate">
                    {draggingTask.description}
                  </div>
                )}
              </div>
            )}
            {draggingColumn && <ColumnDragOverlay category={draggingColumn} />}
          </DragOverlay>
        </DndContext>
      )}

      {!viewDone && recentDoneTasks.length > 0 && (
        <div className="border-t border-cream-200">
          <button
            type="button"
            onClick={() => setShowDoneTasks((s) => !s)}
            className="w-full flex items-center gap-2 px-5 py-2 text-xs text-cocoa-700 hover:bg-cream-50 transition-colors"
            aria-expanded={showDoneTasks}
          >
            {showDoneTasks ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
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

// ============================================================
// CategoryColumn — droppable (aceita tasks E columns) + header draggable
// ============================================================

function CategoryColumn({
  category,
  tasks,
  setEditingId,
  onToggle,
  onDelete,
  onToggleAssignee,
  onChangePriority,
  onChangeStatus,
  draggingTaskId,
  draggingColumn,
  orderCodeById,
  orderClientById,
  voucherCodeById,
  voucherSenderById,
  isMobile,
}: {
  category: TaskCategory;
  tasks: Task[];
  setEditingId: (id: string | null) => void;
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  onToggleAssignee: (t: Task, email: string) => void;
  onChangePriority: (t: Task, p: TaskPriority) => void;
  onChangeStatus: (t: Task, s: TaskStatus) => void;
  draggingTaskId: string | null;
  draggingColumn: TaskCategory | null;
  orderCodeById: Record<string, string>;
  orderClientById: Record<string, string>;
  voucherCodeById: Record<string, string>;
  voucherSenderById: Record<string, string>;
  isMobile: boolean;
}) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const { setNodeRef, isOver } = useDroppable({ id: category });
  const isEmpty = tasks.length === 0;

  // Header é o handle para arrastar a coluna inteira — desactivado no mobile.
  const columnDrag = useDraggable({
    id: `col:${category}`,
    data: { type: "column", category },
  });
  const isColumnDragging = columnDrag.isDragging;
  const isTargetForColumnSwap =
    isOver && draggingColumn !== null && draggingColumn !== category;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-0 rounded-xl bg-surface border border-cream-200 border-t-[3px] overflow-hidden transition-all",
        // Mobile: cada coluna ocupa ~85vw normalmente; coluna vazia
        // encolhe para ~42vw (cabem 2 por snap-screen).
        "snap-start shrink-0",
        isEmpty ? "w-[42vw] max-w-[160px]" : "w-[85vw] max-w-[320px]",
        // PC: vazias usam exactamente a largura do cabeçalho (ícone + nome
        // completo + contagem), sem fixar 110px — assim "Presença online" e
        // "Administrativo" cabem sem truncar. Com tarefas: partilham flex-1
        // do espaço restante.
        isEmpty
          ? "sm:w-auto sm:max-w-none sm:flex-none"
          : "sm:w-auto sm:max-w-none sm:flex-1 sm:basis-0 sm:min-w-[160px]",
        meta.topBorder,
        isOver && !draggingColumn && "ring-2 ring-cocoa-400 ring-offset-1",
        isTargetForColumnSwap && "ring-2 ring-indigo-500 ring-offset-1",
        isColumnDragging && "opacity-40",
      )}
    >
      <div
        ref={isMobile ? undefined : columnDrag.setNodeRef}
        {...(isMobile ? {} : columnDrag.attributes)}
        {...(isMobile ? {} : columnDrag.listeners)}
        className={cn(
          "flex items-center gap-2 px-3 py-2.5 bg-gradient-to-b to-transparent select-none",
          meta.columnTint,
          // Drag handle só no PC. No mobile fica como header estático.
          !isMobile && "cursor-grab active:cursor-grabbing touch-none",
        )}
        title={isMobile ? undefined : "Arrastar para reordenar"}
      >
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
            meta.iconBg,
          )}
        >
          <Icon className={cn("h-4 w-4", meta.iconColor)} />
        </div>
        <span className="text-[13px] font-semibold text-cocoa-900 whitespace-nowrap">
          {TASK_CATEGORY_LABELS[category]}
        </span>
        <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white/70 text-[11px] text-cocoa-700 font-semibold tabular-nums shrink-0">
          {tasks.length}
        </span>
      </div>

      <div
        className={cn(
          "flex-1 max-h-[480px] overflow-y-auto",
          // Vazia: body bem compacto, só o "—" de placeholder. Com tarefas:
          // padding maior para respirar.
          isEmpty ? "px-1.5 py-1" : "p-2 space-y-2 min-h-[80px]",
        )}
      >
        {tasks.length === 0 ? (
          <p className="text-[10px] text-cocoa-400 italic text-center py-1 select-none">
            {isOver && !draggingColumn ? "Largar aqui" : "—"}
          </p>
        ) : (
          tasks.map((task) => (
            <DraggableTaskTile
              key={task.id}
              task={task}
              hidden={draggingTaskId === task.id}
              leftAccent={meta.leftAccent}
              onToggle={() => onToggle(task)}
              onDelete={() => onDelete(task)}
              onToggleAssignee={(email) => onToggleAssignee(task, email)}
              onChangePriority={(p) => onChangePriority(task, p)}
              onChangeStatus={(s) => onChangeStatus(task, s)}
              onEdit={() => setEditingId(task.id)}
              orderCodeById={orderCodeById}
              orderClientById={orderClientById}
              voucherCodeById={voucherCodeById}
              voucherSenderById={voucherSenderById}
              isMobile={isMobile}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ColumnDragOverlay({ category }: { category: TaskCategory }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5 py-2 rounded-lg bg-surface shadow-xl border border-cocoa-300 border-t-[3px] min-w-[160px] cursor-grabbing",
        meta.topBorder,
      )}
    >
      <div
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md shrink-0",
          meta.iconBg,
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", meta.iconColor)} />
      </div>
      <span className="text-[12px] font-semibold text-cocoa-900 truncate">
        {TASK_CATEGORY_LABELS[category]}
      </span>
    </div>
  );
}

// ============================================================
// DraggableTaskTile — visualização de leitura + drag
// ============================================================

function DraggableTaskTile({
  task,
  hidden,
  leftAccent,
  onToggle,
  onDelete,
  onToggleAssignee,
  onChangePriority,
  onChangeStatus,
  onEdit,
  orderCodeById,
  orderClientById,
  voucherCodeById,
  voucherSenderById,
  isMobile,
}: {
  task: Task;
  hidden: boolean;
  leftAccent: string;
  onToggle: () => void;
  onDelete: () => void;
  onToggleAssignee: (email: string) => void;
  onChangePriority: (p: TaskPriority) => void;
  onChangeStatus: (s: TaskStatus) => void;
  onEdit: () => void;
  orderCodeById: Record<string, string>;
  orderClientById: Record<string, string>;
  voucherCodeById: Record<string, string>;
  voucherSenderById: Record<string, string>;
  isMobile: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { type: "task", task },
  });

  const overdue =
    task.due_date && !task.done
      ? differenceInDays(parseISO(task.due_date), new Date()) < 0
      : false;

  return (
    <div
      ref={isMobile ? undefined : setNodeRef}
      {...(isMobile ? {} : attributes)}
      {...(isMobile ? {} : listeners)}
      className={cn(
        "group relative rounded-lg border border-cream-200 border-l-[3px] bg-surface px-2.5 py-2 space-y-1.5 hover:border-cocoa-300 hover:shadow-sm transition-all",
        // Drag handle só no PC. No mobile o card é tocável normalmente
        // (scroll funciona, click no checkbox/avatares/pills funciona).
        !isMobile && "touch-none cursor-grab active:cursor-grabbing",
        leftAccent,
        (hidden || isDragging) && "opacity-30",
      )}
    >
      {/* Badge da encomenda/vale — mostra NOME do cliente/remetente (legível)
          mas o href continua a apontar para o code curto. */}
      {(() => {
        const orderCode = task.order_id ? orderCodeById[task.order_id] : null;
        const voucherCode = task.voucher_id ? voucherCodeById[task.voucher_id] : null;
        if (!orderCode && !voucherCode) return null;
        const href = orderCode
          ? `/preservacao/${orderCode}`
          : `/vale-presente/${voucherCode}`;
        const display = orderCode
          ? (task.order_id ? orderClientById[task.order_id] : null) ?? orderCode
          : (task.voucher_id ? voucherSenderById[task.voucher_id!] : null) ?? voucherCode!;
        const tooltipCode = orderCode ?? voucherCode!;
        return (
          <Link
            href={href}
            onPointerDown={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 max-w-full text-[10px] text-indigo-700 hover:text-indigo-900 hover:underline truncate"
            title={`${display} — ${orderCode ? "encomenda" : "vale"} ${tooltipCode}`}
          >
            <Link2 className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{display}</span>
          </Link>
        );
      })()}

      {/* Title row — sem pr-X reservado: o título usa a largura toda do card.
          Prioridade desceu para a linha de baixo, libertando espaço (queixa
          Maria: títulos quebravam em 4-5 linhas verticais). */}
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggle}
          className="mt-0.5 shrink-0"
          aria-label={task.done ? "Reabrir" : "Marcar como feita"}
          title={task.done ? "Reabrir" : "Marcar como feita"}
        >
          {task.done ? (
            <CheckSquare
              className="h-3.5 w-3.5 text-emerald-600"
              strokeWidth={2}
            />
          ) : (
            <Square
              className="h-3.5 w-3.5 text-[#C4A882] hover:text-emerald-600 transition-colors"
              strokeWidth={2}
            />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div
            className={cn(
              "text-[12px] font-medium leading-snug break-words",
              task.done
                ? "text-cocoa-500 dark:text-[#6E6E73] line-through"
                : "text-cocoa-900",
            )}
          >
            {task.title}
          </div>
        </div>
      </div>

      {/* Descrição — pl-5 alinha o texto com o título (debaixo do título,
          não da checkbox). */}
      {task.description && (
        <div className="text-[11px] text-cocoa-600 leading-snug whitespace-pre-wrap break-words pl-5">
          {linkify(task.description)}
        </div>
      )}

      {/* Linha de chips: estado + prioridade. Em tarefas concluídas o ✅
          já indica o que importa, escondemos os 2 chips. */}
      {!task.done && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusPill status={task.status} onChange={onChangeStatus} />
          <PriorityPill priority={task.priority} onChange={onChangePriority} />
        </div>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        <div className="flex items-center gap-1">
          {TEAM_MEMBERS.map((m) => {
            const active = task.assignee_emails.includes(m.email);
            return (
              <button
                key={m.email}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onToggleAssignee(m.email)}
                title={`${active ? "Tirar" : "Atribuir a"} ${m.name}`}
                aria-pressed={active}
                className={cn(
                  "relative h-4 w-4 rounded-full overflow-hidden transition-all shrink-0",
                  active
                    ? "ring-1 ring-indigo-600 ring-offset-1 ring-offset-surface"
                    : "opacity-30 hover:opacity-100",
                )}
              >
                <Image
                  src={m.photo}
                  alt={m.name}
                  fill
                  sizes="16px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {task.amount != null && (
            <span
              className="text-[11px] font-medium tabular-nums text-cocoa-900"
              title="Valor associado à tarefa"
            >
              {formatEUR(task.amount)}
            </span>
          )}
          {task.due_date && (
            <Badge
              variant="outline"
              className={cn(
                "h-4 px-1 py-0 text-[10px] font-normal",
                overdue
                  ? "bg-rose-100 text-rose-800 border-rose-300"
                  : "bg-slate-100 text-slate-700 border-slate-300",
              )}
            >
              <CalendarIcon className="h-2.5 w-2.5 mr-0.5" />
              {formatDate(task.due_date)}
            </Badge>
          )}
          {task.reminder_at && !task.done && (
            <Badge
              variant="outline"
              className={cn(
                "h-4 px-1 py-0 text-[10px] font-normal bg-violet-100 text-violet-800 border-violet-300",
                task.reminder_sent_at && "opacity-50 line-through",
              )}
              title={
                task.reminder_sent_at
                  ? "Lembrete já enviado"
                  : "Lembrete: recebes uma notificação a esta hora"
              }
            >
              🔔 {formatReminder(task.reminder_at)}
            </Badge>
          )}
          {/* "Há X dias" — sempre visível, mostra a idade da tarefa.
              formatCreatedAgo mantém-se relativo até em datas antigas
              (formatDoneAgo cairia para dd/MM passados 7 dias). */}
          <span
            className="text-[10px] text-cocoa-400 italic"
            title={`Criada: ${formatDate(task.created_at)}`}
          >
            {formatCreatedAgo(task.created_at)}
          </span>

          {/* Edit/trash icons — bottom-right, só no hover */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onEdit}
              className="text-[#C4A882] hover:text-cocoa-700"
              title="Editar"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onDelete}
              className="text-[#C4A882] hover:text-rose-600"
              title="Apagar"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PriorityPill — pill compacto com abreviatura + popover para mudar
// ============================================================

function PriorityPill({
  priority,
  onChange,
}: {
  priority: TaskPriority;
  onChange: (p: TaskPriority) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "shrink-0 inline-flex items-center justify-center rounded-sm border px-1 h-4 text-[9px] font-bold leading-none tracking-wide cursor-pointer hover:brightness-95 transition-all",
          TASK_PRIORITY_COLORS[priority],
        )}
        aria-label={`Prioridade: ${TASK_PRIORITY_LABELS[priority]}`}
        title={`Prioridade: ${TASK_PRIORITY_LABELS[priority]}`}
      >
        {PRIORITY_ABBREV[priority]}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-auto min-w-0 p-1 gap-0.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              onChange(p);
              setOpen(false);
            }}
            className={cn(
              "flex items-center gap-2 w-full text-left px-2 py-1 rounded text-[12px] hover:bg-cream-100 transition-colors",
              priority === p && "bg-cream-50 font-semibold",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full ring-1 ring-inset ring-black/10",
                PRIORITY_DOT_COLOR[p],
              )}
            />
            <span className="text-cocoa-900">{TASK_PRIORITY_LABELS[p]}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// StatusPill — chip GTD: "Por começar / Hoje / Em curso"
// ============================================================

function StatusPill({
  status,
  onChange,
}: {
  status: TaskStatus;
  onChange: (s: TaskStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 h-5 text-[10px] font-medium leading-none cursor-pointer hover:brightness-95 transition-all",
          TASK_STATUS_COLORS[status],
        )}
        aria-label={`Estado: ${TASK_STATUS_LABELS[status]}`}
        title={`Estado: ${TASK_STATUS_LABELS[status]} (click para mudar)`}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full ring-1 ring-inset ring-black/10 shrink-0",
            TASK_STATUS_DOT_COLOR[status],
          )}
        />
        <span className="truncate">{TASK_STATUS_SHORT[status]}</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-auto min-w-0 p-1 gap-0.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {(Object.keys(TASK_STATUS_LABELS) as TaskStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              onChange(s);
              setOpen(false);
            }}
            className={cn(
              "flex items-center gap-2 w-full text-left px-2 py-1 rounded text-[12px] hover:bg-cream-100 transition-colors",
              status === s && "bg-cream-50 font-semibold",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full ring-1 ring-inset ring-black/10",
                TASK_STATUS_DOT_COLOR[s],
              )}
            />
            <span className="text-cocoa-900">{TASK_STATUS_LABELS[s]}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ============================================================
// TaskEditDialog — popup espaçoso para editar a tarefa
// ============================================================
// Substitui o antigo TaskEditForm inline (que ficava apertado na
// largura da coluna). Render no topo de TasksCard, controlado por
// editingId. Edita todos os campos: título, descrição, categoria,
// estado, prioridade, prazo, atribuídos.

function TaskEditDialog({
  task,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task | null;
  onClose: () => void;
  onSave: (
    t: Task,
    next: {
      title: string;
      description: string;
      category: TaskCategory;
      status: TaskStatus;
      priority: TaskPriority;
      due_date: string | null;
      reminder_at: string | null;
      assignee_emails: string[];
    },
  ) => void;
  onDelete: (t: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<TaskCategory>("outros");
  const [status, setStatus] = useState<TaskStatus>("por_comecar");
  const [priority, setPriority] = useState<TaskPriority>("media");
  const [dueDate, setDueDate] = useState<string>("");
  const [reminderAt, setReminderAt] = useState<string>("");
  const [assignees, setAssignees] = useState<string[]>([]);

  // Cada vez que abrimos com uma tarefa nova, repõe o draft a partir dela.
  // Padrão "store info from previous renders" (regra ESLint: nada de useEffect
  // só para sincronizar estado derivado).
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);
  if (task && task.id !== lastTaskId) {
    setLastTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setCategory(task.category);
    setStatus(task.status);
    setPriority(task.priority);
    setDueDate(task.due_date ?? "");
    setReminderAt(reminderIsoToInput(task.reminder_at));
    setAssignees(task.assignee_emails);
  }
  if (!task && lastTaskId !== null) {
    setLastTaskId(null);
  }

  const open = task !== null;

  function handleSave() {
    if (!task) return;
    onSave(task, {
      title,
      description,
      category,
      status,
      priority,
      due_date: dueDate || null,
      reminder_at: reminderInputToIso(reminderAt),
      assignee_emails: assignees,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cocoa-900">
            <Pencil className="h-4 w-4 text-cocoa-600" />
            Editar tarefa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <Label htmlFor="task-edit-title" className="text-xs text-cocoa-700">
              Título
            </Label>
            <Input
              id="task-edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da tarefa"
              className="mt-1"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="task-edit-desc" className="text-xs text-cocoa-700">
              Detalhes
            </Label>
            <Textarea
              id="task-edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notas, links, contexto…"
              className="mt-1 min-h-32 leading-relaxed"
            />
          </div>

          <div>
            <span className="text-xs text-cocoa-700">Atribuir a:</span>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              {TEAM_MEMBERS.map((m) => {
                const active = assignees.includes(m.email);
                return (
                  <button
                    key={m.email}
                    type="button"
                    onClick={() =>
                      setAssignees((prev) =>
                        prev.includes(m.email)
                          ? prev.filter((e) => e !== m.email)
                          : [...prev, m.email],
                      )
                    }
                    title={`${active ? "Tirar" : "Atribuir a"} ${m.name}`}
                    aria-pressed={active}
                    className={cn(
                      "relative h-8 w-8 rounded-full overflow-hidden transition-all",
                      active
                        ? "ring-2 ring-indigo-600 ring-offset-1 ring-offset-surface"
                        : "opacity-40 hover:opacity-100",
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
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs text-cocoa-700">Categoria</Label>
              <Select
                value={category}
                onValueChange={(v) => v && setCategory(v as TaskCategory)}
              >
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue labels={TASK_CATEGORY_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_CATEGORY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-cocoa-700">Estado</Label>
              <Select
                value={status}
                onValueChange={(v) => v && setStatus(v as TaskStatus)}
              >
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue labels={TASK_STATUS_LABELS} />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TASK_STATUS_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-cocoa-700">Prioridade</Label>
              <Select
                value={priority}
                onValueChange={(v) => v && setPriority(v as TaskPriority)}
              >
                <SelectTrigger className="mt-1 h-9 text-sm">
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
            </div>
            <div>
              <Label className="text-xs text-cocoa-700">Prazo</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 h-9 text-sm"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-cocoa-700 flex items-center gap-1">
              🔔 Lembrar-me (data e hora)
            </Label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className="h-9 text-sm"
                title="Recebes uma notificação no telemóvel a esta data e hora"
              />
              {reminderAt && (
                <button
                  type="button"
                  onClick={() => setReminderAt("")}
                  className="text-xs text-cocoa-500 hover:text-rose-600 shrink-0"
                  title="Remover lembrete"
                >
                  limpar
                </button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => task && onDelete(task)}
            className="mr-auto text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Apagar
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={!title.trim()}>
            <Check className="h-4 w-4 mr-1" /> Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
