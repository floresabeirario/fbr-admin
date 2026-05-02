"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";

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

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
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
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(145deg, #0D0804 0%, #1A0F08 35%, #251508 65%, #1A0F08 100%)" }}
    >
      {/* Glow decorativo central */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(196,168,130,0.12) 0%, transparent 65%)" }}
        />
        <div
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(196,168,130,0.06) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(196,168,130,0.05) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-10 w-full px-6">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3">
          <h1
            className="text-5xl md:text-6xl tracking-wide"
            style={{
              fontFamily: "TanMemories",
              fontStyle: "italic",
              color: "rgba(255,255,255,0.92)",
              textShadow: "0 2px 40px rgba(196,168,130,0.3)",
            }}
          >
            Flores à Beira Rio
          </h1>
          <div className="flex items-center gap-4">
            <div className="h-px w-14" style={{ background: "linear-gradient(to right, transparent, rgba(196,168,130,0.5))" }} />
            <span className="text-[10px] tracking-[0.25em] uppercase" style={{ color: "rgba(196,168,130,0.6)" }}>
              Plataforma Interna
            </span>
            <div className="h-px w-14" style={{ background: "linear-gradient(to left, transparent, rgba(196,168,130,0.5))" }} />
          </div>
        </div>

        {/* Card */}
        <div
          className="w-full max-w-sm rounded-3xl border p-8"
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(24px)",
            borderColor: "rgba(255,255,255,0.08)",
            boxShadow: "0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          {!selected ? (
            /* Selecção de perfil */
            <div className="flex flex-col items-center gap-7">
              <p className="text-sm tracking-wide" style={{ color: "rgba(255,255,255,0.45)" }}>
                Quem está a entrar?
              </p>
              <div className="flex gap-7 justify-center">
                {PROFILES.map((profile) => (
                  <button
                    key={profile.name}
                    onClick={() => handleSelectProfile(profile)}
                    className="flex flex-col items-center gap-3 group outline-none"
                  >
                    <div
                      className="w-20 h-20 rounded-2xl overflow-hidden relative transition-all duration-200 group-hover:scale-105"
                      style={{
                        boxShadow: "0 0 0 2px rgba(255,255,255,0.08)",
                        transition: "box-shadow 0.2s, transform 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 2px rgba(196,168,130,0.6), 0 8px 24px rgba(0,0,0,0.4)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 2px rgba(255,255,255,0.08)";
                      }}
                    >
                      <Image src={profile.photo} alt={profile.name} fill className="object-cover" />
                    </div>
                    <span
                      className="text-sm font-medium transition-colors duration-150"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLSpanElement).style.color = "rgba(255,255,255,0.9)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLSpanElement).style.color = "rgba(255,255,255,0.45)"; }}
                    >
                      {profile.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Formulário de password */
            <div className="flex flex-col gap-6">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 text-xs transition-colors w-fit outline-none"
                style={{ color: "rgba(255,255,255,0.35)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.65)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)"; }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Mudar perfil
              </button>

              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-[72px] h-[72px] rounded-2xl overflow-hidden relative"
                  style={{ boxShadow: "0 0 0 2px rgba(196,168,130,0.45), 0 8px 24px rgba(0,0,0,0.4)" }}
                >
                  <Image src={selected.photo} alt={selected.name} fill className="object-cover" />
                </div>
                <span className="font-medium text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
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
                    className="w-full rounded-xl px-4 py-3 text-sm pr-10 outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.9)",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.border = "1px solid rgba(196,168,130,0.5)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(196,168,130,0.1)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.border = "1px solid rgba(255,255,255,0.1)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors outline-none"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)"; }}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {error && (
                  <div
                    className="text-xs text-center py-2 px-3 rounded-xl"
                    style={{ background: "rgba(239,68,68,0.12)", color: "rgba(252,165,165,0.9)", border: "1px solid rgba(239,68,68,0.2)" }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 mt-1 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #D4B896 0%, #C4A882 50%, #B8956A 100%)",
                    color: "#1A0F08",
                    boxShadow: "0 4px 20px rgba(196,168,130,0.3)",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && password) (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 28px rgba(196,168,130,0.5)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 20px rgba(196,168,130,0.3)";
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
          )}
        </div>
      </div>
    </div>
  );
}
