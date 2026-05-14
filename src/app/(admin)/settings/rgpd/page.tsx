import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth/server";
import {
  searchClientData,
  listOrdersDueForRetention,
} from "@/lib/rgpd";
import { RgpdClient } from "./rgpd-client";

type Search = Promise<{ q?: string }>;

export default async function RgpdPage({ searchParams }: { searchParams: Search }) {
  const role = await getCurrentRole();
  if (role !== "admin") {
    redirect("/");
  }

  const params = await searchParams;
  const query = (params.q ?? "").trim();

  const [search, retention] = await Promise.all([
    query ? searchClientData(query) : Promise.resolve({ query: "", orders: [], vouchers: [] }),
    listOrdersDueForRetention(),
  ]);

  return (
    <RgpdClient
      query={query}
      searchResult={search}
      retentionRows={retention.map((r) => ({
        order: r.order,
        reference: r.reference,
        deadline: r.deadline.toISOString(),
        status: r.status,
      }))}
    />
  );
}
