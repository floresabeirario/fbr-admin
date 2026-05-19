import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentRole } from "@/lib/auth/server";
import type { TaskTemplate } from "@/types/tasks";
import TaskTemplatesClient from "./templates-tarefas-client";

export default async function TaskTemplatesPage() {
  const role = await getCurrentRole();
  if (role !== "admin") {
    redirect("/");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("task_templates")
    .select("*")
    .order("scope", { ascending: true })
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  const templates = (data ?? []) as TaskTemplate[];

  return <TaskTemplatesClient initialTemplates={templates} />;
}
