import { createClient } from "@/lib/supabase/server";
import { getCurrentEmail } from "@/lib/auth/server";
import { getUpcomingPickups, getDashboardAlerts } from "@/lib/dashboard";
import type { Order } from "@/types/database";
import type { Voucher } from "@/types/voucher";
import type { Task } from "@/types/tasks";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const email = (await getCurrentEmail()) ?? "";

  const [ordersRes, vouchersRes, tasksRes] = await Promise.all([
    supabase.from("orders").select("*").is("deleted_at", null),
    supabase.from("vouchers").select("*").is("deleted_at", null),
    supabase
      .from("tasks")
      .select("*")
      .is("deleted_at", null)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  const orders: Order[] = (ordersRes.data ?? []) as Order[];
  const vouchers: Voucher[] = (vouchersRes.data ?? []) as Voucher[];
  const tasks: Task[] = (tasksRes.data ?? []) as Task[];

  const pickups = getUpcomingPickups(orders);
  const alerts = getDashboardAlerts(orders, vouchers);

  // Lookups uuid → código curto, para que as tarefas ligadas a uma
  // encomenda/vale possam mostrar um badge clicável no kanban que
  // aponta para o workbench correcto (mig 052: tasks.order_id / .voucher_id).
  const orderCodeById: Record<string, string> = Object.fromEntries(
    orders.map((o) => [o.id, o.order_id]),
  );
  const voucherCodeById: Record<string, string> = Object.fromEntries(
    vouchers.map((v) => [v.id, v.code]),
  );

  return (
    <DashboardClient
      currentEmail={email}
      tasks={tasks}
      pickups={pickups}
      alerts={alerts}
      orderCodeById={orderCodeById}
      voucherCodeById={voucherCodeById}
    />
  );
}
