import { createClient } from "@/lib/supabase/server";
import { LayoutDashboard } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-[#C4A882]" />
        <div>
          <h1 className="text-2xl font-semibold text-[#3D2B1F]">Dashboard</h1>
          <p className="text-sm text-[#8B7355]">
            Bem-vinda, {user?.user_metadata?.name ?? user?.email} 👋
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E8E0D5] bg-white p-6 text-sm text-[#8B7355]">
        Em construção — tarefas, métricas e alertas vêm aqui a seguir.
      </div>
    </div>
  );
}
