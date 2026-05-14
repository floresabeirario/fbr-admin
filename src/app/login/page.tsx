"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const PROFILES = [
  { name: "António", email: "info+antonio@floresabeirario.pt", photo: "/userphotos/antonio.webp" },
  { name: "MJ", email: "info+mj@floresabeirario.pt", photo: "/userphotos/mj.webp" },
  { name: "Ana", email: "info+ana@floresabeirario.pt", photo: "/userphotos/ana.webp" },
];

type Profile = typeof PROFILES[number];

export default function LoginPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<Profile | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.SyntheticEvent<HTMLFormElement>) {
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
    <div className="min-h-screen bg-[#F2F1EE] dark:bg-black flex flex-col">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        {/* Brand */}
        <div className="text-center mb-10">
          <h1
            className="text-[40px] leading-tight text-cocoa-900"
            style={{ fontFamily: "TanMemories" }}
          >
            Flores à Beira Rio
          </h1>
          <p className="mt-2 text-[10px] tracking-[0.22em] uppercase text-[#B8A08A] dark:text-[#6B6B6B]">
            Plataforma Interna
          </p>
        </div>

        {!selected ? (
          /* Perfis — sem caixa */
          <div className="flex flex-col items-center gap-6">
            <p className="text-[13px] text-[#8B8B8B]">
              Quem está a entrar?
            </p>
            <div className="flex gap-8 justify-center">
              {PROFILES.map((profile) => (
                <button
                  key={profile.name}
                  onClick={() => handleSelectProfile(profile)}
                  className="flex flex-col items-center gap-2.5 group outline-none"
                >
                  <div className="w-[72px] h-[72px] rounded-full overflow-hidden relative ring-2 ring-transparent group-hover:ring-[#C4A882] group-focus-visible:ring-[#C4A882] transition-all duration-150">
                    <Image src={profile.photo} alt={profile.name} fill className="object-cover" />
                  </div>
                  <span className="text-[13px] font-medium text-cocoa-900/50 dark:text-white/50 group-hover:text-cocoa-900 dark:group-hover:text-white transition-colors">
                    {profile.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Card com password */
          <div className="w-full max-w-[360px] bg-surface rounded-2xl shadow-[0_2px_20px_rgba(0,0,0,0.07)] dark:shadow-[0_2px_30px_rgba(0,0,0,0.5)]">
            <div className="p-8 flex flex-col gap-5">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-[12px] text-cocoa-900/35 dark:text-white/35 hover:text-cocoa-900 dark:hover:text-white transition-colors w-fit outline-none"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Mudar perfil
              </button>

              <div className="flex flex-col items-center gap-2 py-1">
                <div className="w-16 h-16 rounded-full overflow-hidden relative ring-2 ring-[#C4A882]/50">
                  <Image src={selected.photo} alt={selected.name} fill className="object-cover" />
                </div>
                <span className="text-[14px] font-medium text-[#1C1C1E] dark:text-white">
                  {selected.name}
                </span>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-3">
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    required
                    className="w-full rounded-xl px-4 py-3 text-[15px] pr-11 bg-[#F2F2F7] text-[#1C1C1E] dark:text-white placeholder:text-[#8E8E93] outline-none focus:ring-2 focus:ring-[#C4A882]/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-cocoa-900 dark:hover:text-white transition-colors outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {error && (
                  <p className="text-[12px] text-center text-red-500 dark:text-red-400">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full rounded-xl py-3 text-[15px] font-semibold flex items-center justify-center gap-2 mt-1 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #D4B896 0%, #C4A882 50%, #B8956A 100%)",
                    color: "#1A0F08",
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      A entrar…
                    </>
                  ) : (
                    "Entrar"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
