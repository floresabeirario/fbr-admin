import { NextResponse, type NextRequest } from "next/server";
import { getCurrentRole } from "@/lib/auth/server";
import { fetchContactEmailSummary } from "@/lib/google/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resumo leve dos emails trocados com um cliente: quantos, quando foi o
 * último e quem o escreveu. Serve o selo da aba Email do workbench, que
 * tem de saber que há emails ANTES de ela abrir a aba.
 *
 * GET /api/google/emails/summary?email=cliente@x.pt
 */
export async function GET(request: NextRequest) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const email = request.nextUrl.searchParams.get("email");

  try {
    return NextResponse.json(await fetchContactEmailSummary(email));
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error("[gmail] falha no resumo", err);
    return NextResponse.json({ status: "error", error: message }, { status: 500 });
  }
}
