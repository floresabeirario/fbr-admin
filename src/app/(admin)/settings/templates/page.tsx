import { redirect } from "next/navigation";

// URL movida na sessao 97: /settings/templates -> /comunicacoes/templates
export default function LegacyTemplatesRedirect() {
  redirect("/comunicacoes/templates");
}
