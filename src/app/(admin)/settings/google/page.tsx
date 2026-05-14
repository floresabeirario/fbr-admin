import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth/server";
import { loadIntegration } from "@/lib/google/oauth";
import { GoogleSettingsClient } from "./settings-client";

type Search = Promise<{
  ok?: string;
  error?: string;
  got?: string;
  detail?: string;
}>;

export default async function GoogleSettingsPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    redirect("/");
  }

  const integration = await loadIntegration();
  const params = await searchParams;

  return (
    <GoogleSettingsClient
      integration={integration}
      okFlag={params.ok === "1"}
      errorCode={params.error}
      errorDetail={params.detail}
      gotEmail={params.got}
    />
  );
}
