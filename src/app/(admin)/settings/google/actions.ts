"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/server";
import { disconnectIntegration } from "@/lib/google/oauth";
import { ensureRootFolders } from "@/lib/google/drive";
import { ensureCalendar } from "@/lib/google/calendar";

export async function disconnectGoogleAction(): Promise<void> {
  await requireAdmin();
  await disconnectIntegration();
  revalidatePath("/settings/google");
}

export async function ensureRootFoldersAction(): Promise<{
  rootId: string;
  ordersId: string;
  vouchersId: string;
}> {
  await requireAdmin();
  const result = await ensureRootFolders();
  revalidatePath("/settings/google");
  return result;
}

export async function ensureCalendarAction(): Promise<{ calendarId: string }> {
  await requireAdmin();
  const calendarId = await ensureCalendar();
  revalidatePath("/settings/google");
  return { calendarId };
}
