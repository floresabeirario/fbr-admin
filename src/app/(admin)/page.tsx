import { createClient } from "@/lib/supabase/server";
import { getCurrentEmail, getCurrentRole } from "@/lib/auth/server";
import { getUpcomingPickups, getDashboardAlerts } from "@/lib/dashboard";
import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import type { Task, ChecklistItem } from "@/types/tasks";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const email = (await getCurrentEmail()) ?? "";
  const role = await getCurrentRole();

  // Tudo em paralelo
  const [ordersRes, vouchersRes, tasksRes, checklistRes] = await Promise.all([
    supabase.from("orders").select("*").is("deleted_at", null),
    supabase.from("vouchers").select("*").is("deleted_at", null),
    supabase
      .from("tasks")
      .select("*")
      .is("deleted_at", null)
      .order("due_date", { ascending: true, nullsFirst: false }),
    // Admin vê todas as checklists; viewer só a sua (RLS garante).
    supabase
      .from("personal_checklist")
      .select("*")
      .is("deleted_at", null)
      .order("position", { ascending: true }),
  ]);

  const orders: Order[] = (ordersRes.data ?? []) as Order[];
  const vouchers: Voucher[] = (vouchersRes.data ?? []) as Voucher[];
  const tasks: Task[] = (tasksRes.data ?? []) as Task[];
  const checklist: ChecklistItem[] = (checklistRes.data ?? []) as ChecklistItem[];

  const pickups = getUpcomingPickups(orders);
  const alerts = getDashboardAlerts(orders, vouchers);

  return (
    <DashboardClient
      currentEmail={email}
      role={role}
      tasks={tasks}
      checklist={checklist}
      pickups={pickups}
      alerts={alerts}
    />
  );
}
