"use client";

import Link from "next/link";
import Image from "next/image";
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
  LineChart,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Settings,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { roleForEmail, ROLE_LABELS, type Role } from "@/lib/auth/roles";

const PROFILES = [
  { name: "António", email: "info+antonio@floresabeirario.pt", photo: "/userphotos/antonio.webp" },
  { name: "MJ", email: "info+mj@floresabeirario.pt", photo: "/userphotos/mj.webp" },
  { name: "Ana", email: "info+ana@floresabeirario.pt", photo: "/userphotos/ana.webp" },
];

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  parent?: string; // href do pai — renderiza indentado
};

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/metricas", label: "Métricas", icon: LineChart, parent: "/" },
  { href: "/preservacao", label: "Preservação de Flores", icon: Flower2 },
  { href: "/status", label: "Status", icon: Radio, parent: "/preservacao" },
  { href: "/vale-presente", label: "Vale-Presente", icon: Gift },
  { href: "/parcerias", label: "Parcerias", icon: Handshake },
  { href: "/financas", label: "Finanças", icon: Euro },
  { href: "/entregas-recolhas", label: "Entregas e Recolhas", icon: Truck },
  { href: "/ecossistema", label: "Ecossistema", icon: Globe },
  { href: "/healthchecks", label: "Healthchecks", icon: HeartPulse },
  { href: "/ideias", label: "Ideias Futuras", icon: Lightbulb },
  { href: "/settings/google", label: "Definições Google", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [profile, setProfile] = useState<{ name: string; photo: string; role: Role } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) {
        const match = PROFILES.find(p => p.email === data.user!.email);
        if (match) setProfile({ ...match, role: roleForEmail(data.user!.email) });
      }
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAF8F5] dark:bg-[#0D0D0D]">
      {/* Sidebar — click em qualquer zona não-interactiva expande/colapsa */}
      <aside
        onClick={(e) => {
          const interactive = (e.target as HTMLElement).closest(
            "a, button, input, [role='button']"
          );
          if (!interactive) setCollapsed((c) => !c);
        }}
        className={cn(
          "flex flex-col h-full bg-white dark:bg-[#141414] border-r border-[#E8E0D5] dark:border-[#2C2C2E] transition-all duration-200 shrink-0 cursor-pointer",
          collapsed ? "w-16" : "w-56"
        )}
        title={collapsed ? "Click para expandir" : "Click para recolher"}
      >
        {/* Logo */}
        <div className={cn("flex items-center h-14 px-4 border-b border-[#E8E0D5] dark:border-[#2C2C2E] shrink-0", collapsed && "justify-center")}>
          {!collapsed && (
            <span className="font-['TanMemories'] text-lg text-[#3D2B1F] dark:text-[#E8D5B5] truncate">
              FBR Admin
            </span>
          )}
          {collapsed && (
            <span className="font-['TanMemories'] text-lg text-[#3D2B1F] dark:text-[#E8D5B5]">F</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 flex flex-col gap-0.5 overflow-y-auto px-2">
          {navItems
            .filter((item) =>
              item.href.startsWith("/settings") ? profile?.role === "admin" : true,
            )
            .map(({ href, label, icon: Icon, parent }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            const isSub = !!parent;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors",
                  isSub && !collapsed ? "pl-7 pr-2 ml-2 border-l border-[#E8E0D5] dark:border-[#2C2C2E] text-[13px]" : "px-2",
                  active
                    ? "bg-[#F0EAE0] dark:bg-[#2C2C2E] text-[#3D2B1F] dark:text-[#E8D5B5]"
                    : "text-[#8B7355] dark:text-[#8E8E93] hover:bg-[#FAF8F5] dark:hover:bg-[#2C2C2E] hover:text-[#3D2B1F] dark:hover:text-[#F5F5F5]"
                )}
                title={collapsed ? label : undefined}
              >
                <Icon className={cn("shrink-0", isSub ? "h-3.5 w-3.5" : "h-4 w-4")} />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-[#E8E0D5] dark:border-[#2C2C2E] flex flex-col gap-0.5">
          {profile && (
            <div className={cn("flex items-center gap-2.5 px-2 py-1.5 rounded-lg", collapsed && "justify-center")}>
              <div className="w-7 h-7 rounded-full overflow-hidden relative shrink-0">
                <Image src={profile.photo} alt={profile.name} fill className="object-cover" />
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="text-sm font-medium text-[#3D2B1F] dark:text-[#E8D5B5] truncate">{profile.name}</span>
                  {profile.role === "viewer" && (
                    <span className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">
                      {ROLE_LABELS.viewer}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-[#8B7355] dark:text-[#8E8E93] hover:bg-[#FAF8F5] dark:hover:bg-[#2C2C2E] hover:text-[#3D2B1F] dark:hover:text-[#F5F5F5] transition-colors w-full",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Sair" : undefined}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>

          <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between px-0.5")}>
            {!collapsed && <ThemeToggle />}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-center rounded-lg p-2 text-[#B8A99A] dark:text-[#8E8E93] hover:bg-[#FAF8F5] dark:hover:bg-[#2C2C2E] hover:text-[#3D2B1F] dark:hover:text-[#F5F5F5] transition-colors"
              title={collapsed ? "Expandir" : "Recolher"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {collapsed && <ThemeToggle className="mx-auto" />}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 h-full overflow-auto">
        {children}
      </main>
    </div>
  );
}
