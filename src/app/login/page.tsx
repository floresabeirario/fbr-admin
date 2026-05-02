"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";

const PROFILES = [
  { name: "António", initials: "A", email: "info+antonio@floresabeirario.pt", color: "#C4A882" },
  { name: "MJ", initials: "MJ", email: "info+mj@floresabeirario.pt", color: "#8B7355" },
  { name: "Ana", initials: "An", email: "info+ana@floresabeirario.pt", color: "#B8A99A" },
];

type Profile = typeof PROFILES[number];

export default function LoginPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Profile | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: selected.email,
      password,
    });

    if (error) {
      setError("Password incorrecta. Tenta novamente.");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  function handleSelectProfile(profile: Profile) {
    setSelected(profile);
    setPassword("");
    setError("");
  }

  function handleBack() {
    setSelected(null);
    setPassword("");
    setError("");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF8F5] px-6">
      {/* Logo */}
      <div className="mb-10 flex flex-col items-center gap-1">
        <span className="font-['TanMemories'] text-3xl tracking-wide text-[#3D2B1F]">
          Flores à Beira Rio
        </span>
        <span className="text-sm text-[#8B7355]">Plataforma de gestão interna</span>
      </div>

      {!selected ? (
        /* Ecrã de selecção de perfil */
        <div className="flex flex-col items-center gap-8">
          <p className="text-[#3D2B1F] font-medium">Quem está a entrar?</p>
          <div className="flex gap-8">
            {PROFILES.map((profile) => (
              <button
                key={profile.name}
                onClick={() => handleSelectProfile(profile)}
                className="flex flex-col items-center gap-3 group"
              >
                <div
                  className="w-24 h-24 rounded-xl flex items-center justify-center text-white text-2xl font-semibold shadow-sm transition-all duration-150 group-hover:scale-105 group-hover:shadow-md"
                  style={{ backgroundColor: profile.color }}
                >
                  {profile.initials}
                </div>
                <span className="text-sm text-[#8B7355] group-hover:text-[#3D2B1F] transition-colors">
                  {profile.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Ecrã de password */
        <div className="w-full max-w-xs flex flex-col items-center gap-6">
          <button
            onClick={handleBack}
            className="self-start flex items-center gap-1.5 text-sm text-[#8B7355] hover:text-[#3D2B1F] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Mudar perfil
          </button>

          <div className="flex flex-col items-center gap-3">
            <div
              className="w-20 h-20 rounded-xl flex items-center justify-center text-white text-xl font-semibold shadow-sm"
              style={{ backgroundColor: selected.color }}
            >
              {selected.initials}
            </div>
            <span className="font-medium text-[#3D2B1F]">{selected.name}</span>
          </div>

          <form onSubmit={handleLogin} className="w-full flex flex-col gap-3">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
                className="w-full rounded-xl border border-[#E8E0D5] bg-white px-4 py-3 text-sm text-[#3D2B1F] placeholder:text-[#B8A99A] focus:outline-none focus:ring-2 focus:ring-[#C4A882] focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8A99A] hover:text-[#8B7355]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-500 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-xl bg-[#3D2B1F] py-3 text-sm font-medium text-white transition hover:bg-[#5C3D2E] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "A entrar…" : "Entrar"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
