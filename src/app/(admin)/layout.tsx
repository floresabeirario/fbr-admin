"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Flower2,
  Gift,
  Radio,
  Handshake,
  Euro,
  Truck,
  Globe,
  HeartPulse,
  Lightbulb,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/preservacao", label: "Preservação de Flores", icon: Flower2 },
  { href: "/vale-presente", label: "Vale-Presente", icon: Gift },
  { href: "/status", label: "Status", icon: Radio },
  { href: "/parcerias", label: "Parcerias", icon: Handshake },
  { href: "/financas", label: "Finanças", icon: Euro },
  { href: "/entregas-recolhas", label: "Entregas e Recolhas", icon: Truck },
  { href: "/ecossistema", label: "Ecossistema", icon: Globe },
  { href: "/healthchecks", label: "Healthchecks", icon: HeartPulse },
  { href: "/ideias", label: "Ideias Futuras", icon: Lightbulb },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen bg-[#FAF8F5]">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-white border-r border-[#E8E0D5] transition-all duration-200 shrink-0",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center h-14 px-4 border-b border-[#E8E0D5] shrink-0", collapsed && "justify-center")}>
          {!collapsed && (
            <span className="font-['TanMemories'] text-lg text-[#3D2B1F] truncate">
              FBR Admin
            </span>
          )}
          {collapsed && (
            <span className="font-['TanMemories'] text-lg text-[#3D2B1F]">F</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-[#F0EAE0] text-[#3D2B1F]"
                    : "text-[#8B7355] hover:bg-[#FAF8F5] hover:text-[#3D2B1F]"
                )}
                title={collapsed ? label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-[#E8E0D5] flex flex-col gap-0.5">
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-[#8B7355] hover:bg-[#FAF8F5] hover:text-[#3D2B1F] transition-colors w-full",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Sair" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center rounded-lg p-2 text-[#B8A99A] hover:bg-[#FAF8F5] hover:text-[#3D2B1F] transition-colors w-full"
            title={collapsed ? "Expandir" : "Recolher"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
