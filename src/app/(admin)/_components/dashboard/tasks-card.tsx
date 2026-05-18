"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { differenceInDays, parseISO } from "date-fns";
import {
  Camera,
  CalendarDays as CalendarIcon,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  FileText,
  Flower2,
  Globe,
  ListTodo,
  Loader2,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Square,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
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

import type { Task, TaskCategory, TaskPriority } from "@/types/tasks";
import {
  TASK_CATEGORY_LABELS,
  TASK_CATEGORY_ORDER,
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

// Identidade visual por categoria — ícone distinto + barra colorida no topo
// da coluna + tom claro de fundo. Não usamos pills coloridos porque (i) ficavam
// indistinguíveis das outras pills da app, e (ii) o cabeçalho fica mais limpo
// com ícone + texto.
const CATEGORY_META: Record<
  TaskCategory,
  {
    icon: LucideIcon;
    topBorder: string; // border-t-[3px] colour
    iconBg: string; // pequeno quadrado por trás do ícone
    iconColor: string;
    columnTint: string; // fundo subtil do header da coluna
    leftAccent: string; // border-l do tile
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
    icon: Camera,
    topBorder: "border-t-purple-500",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    columnTint: "from-purple-50/40",
    leftAccent: "border-l-purple-400",
  },
  administrativo: {
    icon: FileText,
    topBorder: "border-t-zinc-500",
    iconBg: "bg-zinc-100",
    iconColor: "text-zinc-700",
    columnTint: "from-zinc-50/40",
    leftAccent: "border-l-zinc-400",
  },
  outros: {
    icon: MoreHorizontal,
    topBorder: "border-t-stone-400",
    iconBg: "bg-stone-100",
    iconColor: "text-stone-600",
    columnTint: "from-stone-50/40",
    leftAccent: "border-l-stone-300",
  },
};

const CATEGORY_ORDER = (
  Object.keys(TASK_CATEGORY_LABELS) as TaskCategory[]
).sort((a, b) => TASK_CATEGORY_ORDER[a] - TASK_CATEGORY_ORDER[b]);

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
  const [newDescription, setNewDescription] = useState("");
  const [newAssignees, setNewAssignees] = useState<string[]>([]);
  const [newPriority, setNewPriority] = useState<TaskPriority>("media");
  const [newCategory, setNewCategory] = useState<TaskCategory>("outros");
  const [newDueDate, setNewDueDate] = useState<string>("");

  // Edição inline por tarefa.
  const [editingId, setEditingId] = useState<string | null>(null);

  // DnD
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const collisionDetection: CollisionDetection = (args) => {
    const pointer = pointerWithin(args);
    return pointer.length > 0 ? pointer : rectIntersection(args);
  };

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
    setNewDescription("");
    setNewAssignees([]);
    setNewPriority("media");
    setNewCategory("outros");
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
          description: newDescription.trim() || null,
          assignee_emails: newAssignees,
          seen_by: seenBy,
          priority: newPriority,
          category: newCategory,
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
    next: { title: string; description: string; priority: TaskPriority; due_date: string | null },
  ) {
    const trimmed = next.title.trim();
    if (!trimmed) {
      toast.error("O título não pode ficar vazio.");
      return;
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              title: trimmed,
              description: next.description.trim() || null,
              priority: next.priority,
              due_date: next.due_date,
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
          priority: next.priority,
          due_date: next.due_date,
        });
      } catch (err) {
        toast.error("Erro ao guardar: " + (err as Error).message);
      }
    });
  }

  // DnD handlers
  function handleDragStart(event: DragStartEvent) {
    const t = event.active.data.current?.task as Task | undefined;
    if (t) setDraggingTask(t);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingTask(null);
    const { active, over } = event;
    const task = active.data.current?.task as Task | undefined;
    if (!task || !over) return;
    const target = String(over.id) as TaskCategory;
    if (!(target in CATEGORY_META)) return;
    if (target === task.category) return;
    handleCategoryChange(task, target);
  }

  return (
    <SectionCard
      title="Afazeres globais"
      icon={ListTodo}
      iconColor="text-indigo-600"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={newCategory} onValueChange={(v) => v && setNewCategory(v as TaskCategory)}>
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

      {visibleTasks.length === 0 ? (
        <div className="px-5 py-3">
          <p className="text-sm text-cocoa-700 py-6 text-center">
            Sem tarefas {filter === "minhas" ? "atribuídas a ti" : filter === "feitas" ? "concluídas" : ""}.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingTask(null)}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 px-5 py-3">
            {CATEGORY_ORDER.map((category) => (
              <CategoryColumn
                key={category}
                category={category}
                tasks={tasksByCategory[category]}
                editingId={editingId}
                setEditingId={setEditingId}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onToggleAssignee={toggleAssignee}
                onChangePriority={handlePriorityChange}
                onEditSave={handleEditSave}
                draggingId={draggingTask?.id ?? null}
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
          </DragOverlay>
        </DndContext>
      )}

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

// ============================================================
// CategoryColumn — droppable
// ============================================================

function CategoryColumn({
  category,
  tasks,
  editingId,
  setEditingId,
  onToggle,
  onDelete,
  onToggleAssignee,
  onChangePriority,
  onEditSave,
  draggingId,
}: {
  category: TaskCategory;
  tasks: Task[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  onToggle: (t: Task) => void;
  onDelete: (t: Task) => void;
  onToggleAssignee: (t: Task, email: string) => void;
  onChangePriority: (t: Task, p: TaskPriority) => void;
  onEditSave: (
    t: Task,
    next: { title: string; description: string; priority: TaskPriority; due_date: string | null },
  ) => void;
  draggingId: string | null;
}) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const { setNodeRef, isOver } = useDroppable({ id: category });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-0 rounded-xl bg-surface border border-cream-200 border-t-[3px] overflow-hidden transition-all",
        meta.topBorder,
        isOver && "ring-2 ring-cocoa-400 ring-offset-1",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-2.5 py-2 bg-gradient-to-b to-transparent",
          meta.columnTint,
        )}
      >
        <div className={cn("flex h-6 w-6 items-center justify-center rounded-md shrink-0", meta.iconBg)}>
          <Icon className={cn("h-3.5 w-3.5", meta.iconColor)} />
        </div>
        <span className="text-[12px] font-semibold text-cocoa-900 truncate">
          {TASK_CATEGORY_LABELS[category]}
        </span>
        <span className="ml-auto text-[10px] text-cocoa-500 font-medium tabular-nums shrink-0">
          {tasks.length}
        </span>
      </div>

      <div className="flex-1 p-1.5 space-y-1.5 min-h-[80px] max-h-[480px] overflow-y-auto">
        {tasks.length === 0 ? (
          <p className="text-[10px] text-cocoa-400 italic text-center py-4 select-none">
            {isOver ? "Largar aqui" : "—"}
          </p>
        ) : (
          tasks.map((task) =>
            editingId === task.id ? (
              <TaskEditForm
                key={task.id}
                task={task}
                onCancel={() => setEditingId(null)}
                onSave={(next) => onEditSave(task, next)}
                leftAccent={meta.leftAccent}
              />
            ) : (
              <DraggableTaskTile
                key={task.id}
                task={task}
                hidden={draggingId === task.id}
                leftAccent={meta.leftAccent}
                onToggle={() => onToggle(task)}
                onDelete={() => onDelete(task)}
                onToggleAssignee={(email) => onToggleAssignee(task, email)}
                onChangePriority={(p) => onChangePriority(task, p)}
                onEdit={() => setEditingId(task.id)}
              />
            ),
          )
        )}
      </div>
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
  onEdit,
}: {
  task: Task;
  hidden: boolean;
  leftAccent: string;
  onToggle: () => void;
  onDelete: () => void;
  onToggleAssignee: (email: string) => void;
  onChangePriority: (p: TaskPriority) => void;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const overdue =
    task.due_date && !task.done
      ? differenceInDays(parseISO(task.due_date), new Date()) < 0
      : false;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "group rounded-md border border-cream-200 border-l-[3px] bg-surface px-2 py-1.5 space-y-1 hover:border-cocoa-300 hover:shadow-sm transition-all touch-none cursor-grab active:cursor-grabbing",
        leftAccent,
        (hidden || isDragging) && "opacity-30",
      )}
    >
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
            <CheckSquare className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />
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
          {task.description && (
            <div className="text-[11px] text-cocoa-600 leading-snug whitespace-pre-wrap mt-0.5">
              {task.description}
            </div>
          )}
        </div>

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

      <div className="flex items-center gap-1 flex-wrap">
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

      <div className="flex items-center gap-1 flex-wrap">
        <Select
          value={task.priority}
          onValueChange={(v) => v && onChangePriority(v as TaskPriority)}
        >
          <SelectTrigger
            onPointerDown={(e) => e.stopPropagation()}
            className={cn(
              "h-4 px-1 py-0 text-[10px] w-auto min-w-0 gap-0.5 border",
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
      </div>
    </div>
  );
}

// ============================================================
// TaskEditForm — modo edição inline
// ============================================================

function TaskEditForm({
  task,
  onCancel,
  onSave,
  leftAccent,
}: {
  task: Task;
  onCancel: () => void;
  onSave: (next: {
    title: string;
    description: string;
    priority: TaskPriority;
    due_date: string | null;
  }) => void;
  leftAccent: string;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState<string>(task.due_date ?? "");

  return (
    <div
      className={cn(
        "rounded-md border border-cocoa-300 border-l-[3px] bg-cream-50 px-2 py-1.5 space-y-1.5",
        leftAccent,
      )}
    >
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        className="h-7 text-[12px]"
        autoFocus
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Detalhes (opcional)"
        className="min-h-12 text-[11px] py-1 leading-snug"
      />
      <div className="flex items-center gap-1 flex-wrap">
        <Select value={priority} onValueChange={(v) => v && setPriority(v as TaskPriority)}>
          <SelectTrigger
            className={cn(
              "h-5 px-1.5 py-0 text-[10px] w-auto min-w-0 gap-1 border",
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
          className="h-5 text-[10px] px-1 w-auto"
        />
      </div>
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={onCancel}
          className="text-cocoa-500 hover:text-cocoa-700 p-1"
          title="Cancelar"
        >
          <X className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              title,
              description,
              priority,
              due_date: dueDate || null,
            })
          }
          className="text-emerald-600 hover:text-emerald-700 p-1"
          title="Guardar"
        >
          <Check className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
