import { NextResponse } from "next/server";
import { getCurrentRole } from "@/lib/auth/server";
import { searchClientData } from "@/lib/rgpd";

export async function GET(request: Request) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "missing_query" }, { status: 400 });
  }

  const result = await searchClientData(query);

  const payload = {
    rgpd_export: {
      generated_at: new Date().toISOString(),
      generated_by: "FBR Admin",
      legal_basis: "Art. 15 RGPD — direito de acesso aos dados pessoais",
      query: result.query,
      summary: {
        orders: result.orders.length,
        vouchers: result.vouchers.length,
      },
    },
    orders: result.orders,
    vouchers: result.vouchers,
  };

  const filename = `fbr-rgpd-${query.replace(/[^a-zA-Z0-9._-]+/g, "_")}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
