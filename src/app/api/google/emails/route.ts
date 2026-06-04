import { NextResponse, type NextRequest } from "next/server";
import { getCurrentRole } from "@/lib/auth/server";
import { fetchThreadsWithContact } from "@/lib/google/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Devolve (read-only) as threads de email trocadas com um cliente.
 * Chamada pelo painel "Email" do workbench (Preservação + Vale-Presente).
 *
 * GET /api/google/emails?email=cliente@x.pt
 */
export async function GET(request: NextRequest) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const email = request.nextUrl.searchParams.get("email");

  try {
    const result = await fetchThreadsWithContact(email);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error("[gmail] falha a puxar threads", err);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
