import { redirect } from "next/navigation";

// URL movida na sessao 97: /settings/ai -> /comunicacoes/claudio
export default function LegacyAiRedirect() {
  redirect("/comunicacoes/claudio");
}
