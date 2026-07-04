import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { reminderItemFor } from "@/lib/push/daily";
import { sendPushToAdmins, sendPushToEmails } from "@/lib/push/send";
import type { Task } from "@/types/tasks";

// Cron de lembretes pontuais das tarefas ("lembra-me a esta data/hora").
// Corre de fora, ~10 em 10 min (GitHub Actions), porque o cron do plano
// Hobby da Vercel só corre 1×/dia. Dispara os lembretes cuja hora já
// passou e ainda não foram enviados, e marca-os como enviados.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await supabase
    .from("tasks")
    .select("id, title, assignee_emails, reminder_at")
    .is("deleted_at", null)
    .eq("done", false)
    .is("reminder_sent_at", null)
    .not("reminder_at", "is", null)
    .lte("reminder_at", nowIso);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tasks = (due ?? []) as unknown as Task[];
  let sent = 0;
  for (const t of tasks) {
    const { recipients, payload } = reminderItemFor(t);
    // Marca como enviado ANTES de enviar: se o envio falhar, preferimos
    // perder 1 lembrete a martelá-lo de 10 em 10 min para sempre.
    const { error: markErr } = await supabase
      .from("tasks")
      .update({ reminder_sent_at: nowIso })
      .eq("id", t.id)
      .is("reminder_sent_at", null); // corrida: só o 1º ticker ganha
    if (markErr) continue;

    if (recipients?.length) {
      await sendPushToEmails(supabase, recipients, payload);
    } else {
      await sendPushToAdmins(supabase, payload);
    }
    sent++;
  }

  return NextResponse.json({ ok: true, checked: tasks.length, sent });
}
