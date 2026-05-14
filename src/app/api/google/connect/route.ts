import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { buildConsentUrl } from "@/lib/google/oauth";
import { getCurrentRole } from "@/lib/auth/server";

export async function GET() {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Sem permissão. Apenas administradores podem conectar o Google." },
      { status: 403 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildConsentUrl(state));
}
