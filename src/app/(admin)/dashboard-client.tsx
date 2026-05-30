"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronRight, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

import type { Task } from "@/types/tasks";
import type { PickupItem, DashboardAlert } from "@/lib/dashboard";

import { markTasksSeenAction } from "./actions";

import { TasksCard } from "./_components/dashboard/tasks-card";
import { PickupsCard } from "./_components/dashboard/pickups-card";
import { AlertsCard } from "./_components/dashboard/alerts-card";
import { memberName } from "./_components/dashboard/team-members";

interface Props {
  currentEmail: string;
  tasks: Task[];
  pickups: PickupItem[];
  alerts: DashboardAlert[];
  orderCodeById: Record<string, string>;
  orderClientById: Record<string, string>;
  voucherCodeById: Record<string, string>;
  voucherSenderById: Record<string, string>;
}

export default function DashboardClient({
  currentEmail,
  tasks: initialTasks,
  pickups,
  alerts,
  orderCodeById,
  orderClientById,
  voucherCodeById,
  voucherSenderById,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const myOpenTasksCount = tasks.filter(
    (t) => !t.done && t.assignee_emails.includes(currentEmail),
  ).length;

  // Notificações: ao abrir o Dashboard, mostra toast com tarefas
  // atribuídas a mim ainda não vistas e marca-as como vistas.
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

    void markTasksSeenAction(unseen.map((t) => t.id)).catch(() => {});
  }, [currentEmail, initialTasks]);

  return (
    <div className="p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-[#C4A882]" />
        <div>
          <h1 className="text-2xl font-semibold text-cocoa-900">Dashboard</h1>
          <p className="text-sm text-cocoa-700">
            Bem-vinda, {memberName(currentEmail)} 👋{" "}
            {myOpenTasksCount === 0 ? (
              <span>não tens tarefas por completar.</span>
            ) : (
              <span>
                tens{" "}
                <span className="font-semibold text-cocoa-900">{myOpenTasksCount}</span>{" "}
                {myOpenTasksCount === 1 ? "tarefa" : "tarefas"} por completar.
              </span>
            )}
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

      <TasksCard
        tasks={tasks}
        setTasks={setTasks}
        currentEmail={currentEmail}
        orderCodeById={orderCodeById}
        orderClientById={orderClientById}
        voucherCodeById={voucherCodeById}
        voucherSenderById={voucherSenderById}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <PickupsCard pickups={pickups} />
        <AlertsCard alerts={alerts} />
      </div>
    </div>
  );
}
