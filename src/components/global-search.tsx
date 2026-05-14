"use client";

// ============================================================
// GlobalSearch — palette Cmd+K (Ctrl+K) com pesquisa multi-tabela
// ============================================================
// Montado uma vez no layout admin. Reage ao atalho Cmd/Ctrl+K
// e ao evento `fbr-open-search` para se abrir a partir de
// botões na sidebar e na top-bar.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Flower2,
  Gift,
  Handshake,
  Lightbulb,
  BookOpen,
  Loader2,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  globalSearchAction,
  type SearchResult,
  type SearchResultKind,
} from "@/app/(admin)/search/actions";

const KIND_LABEL: Record<SearchResultKind, string> = {
  order: "Encomendas",
  voucher: "Vales-presente",
  partner: "Parceiros",
  idea: "Ideias",
  recipe: "Receitas",
};

const KIND_ICON: Record<SearchResultKind, React.ComponentType<{ className?: string }>> = {
  order: Flower2,
  voucher: Gift,
  partner: Handshake,
  idea: Lightbulb,
  recipe: BookOpen,
};

const KIND_ORDER: SearchResultKind[] = [
  "order",
  "voucher",
  "partner",
  "recipe",
  "idea",
];

function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, setPending] = useState(false);

  // Token incremental para descartar respostas obsoletas (race-condition).
  const reqIdRef = useRef(0);

  // Atalho Cmd/Ctrl+K + evento custom para o botão da sidebar.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if ((e.metaKey || e.ctrlKey) && k === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    function onCustomOpen() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("fbr-open-search", onCustomOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("fbr-open-search", onCustomOpen);
    };
  }, []);

  // Debounce do server action — 220ms depois da última tecla.
  useEffect(() => {
    if (query.trim().length < 2) return;
    const myId = ++reqIdRef.current;
    const timer = setTimeout(async () => {
      try {
        const res = await globalSearchAction(query);
        if (reqIdRef.current === myId) {
          setResults(res.results);
          setPending(false);
        }
      } catch {
        if (reqIdRef.current === myId) {
          setResults([]);
          setPending(false);
        }
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  function onValueChange(v: string) {
    setQuery(v);
    if (v.trim().length < 2) {
      setResults([]);
      setPending(false);
      reqIdRef.current++; // invalida qualquer pedido pendente
    } else {
      setPending(true);
    }
  }

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (!o) {
      // Limpa tudo quando fecha — próxima abertura começa fresca.
      setQuery("");
      setResults([]);
      setPending(false);
      reqIdRef.current++;
    }
  }

  function goTo(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  // Agrupa resultados por kind preservando a ordem definida.
  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: results.filter((r) => r.kind === kind),
  })).filter((g) => g.items.length > 0);

  const showEmpty = query.trim().length >= 2 && !pending && results.length === 0;
  const showHint = query.trim().length < 2;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pesquisar"
      description="Pesquisar em encomendas, vales, parceiros, ideias e receitas."
      className="max-w-xl"
    >
      <Command shouldFilter={false} label="Pesquisa global">
      <CommandInput
        placeholder="Procurar em encomendas, vales, parceiros, ideias, receitas…"
        value={query}
        onValueChange={onValueChange}
      />
      <CommandList>
        {showHint && (
          <div className="px-3 py-6 text-center text-sm text-[#8B7355] dark:text-[#8E8E93]">
            Escreve pelo menos 2 caracteres para procurar.
          </div>
        )}
        {pending && (
          <div className="px-3 py-6 text-center text-sm text-[#8B7355] dark:text-[#8E8E93]">
            <Loader2 className="inline-block h-4 w-4 animate-spin mr-2" />
            A procurar…
          </div>
        )}
        {showEmpty && (
          <CommandEmpty>
            Nada encontrado para <strong>&ldquo;{query}&rdquo;</strong>.
          </CommandEmpty>
        )}
        {!pending && grouped.map((g) => {
          const Icon = KIND_ICON[g.kind];
          return (
            <CommandGroup key={g.kind} heading={KIND_LABEL[g.kind]}>
              {g.items.map((r) => (
                <CommandItem
                  key={`${r.kind}-${r.id}`}
                  value={`${r.kind}-${r.id}-${r.title}-${r.meta ?? ""}`}
                  onSelect={() => goTo(r.href)}
                >
                  <Icon className="h-4 w-4 text-[#8B7355]" />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate text-sm">{r.title}</span>
                    {r.subtitle && (
                      <span className="truncate text-[11px] text-[#B8A99A]">
                        {r.subtitle}
                      </span>
                    )}
                  </div>
                  {r.meta && (
                    <span className="ml-2 shrink-0 rounded-full bg-[#F0EAE0] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[#8B7355] dark:bg-[#2C2C2E] dark:text-[#B8A99A]">
                      {r.meta}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
      <div className="border-t border-[#E8E0D5] dark:border-[#2C2C2E] px-3 py-2 text-[11px] text-[#B8A99A] dark:text-[#8E8E93] flex items-center justify-between">
        <span>↑↓ navegar · ↵ abrir · Esc fechar</span>
        <span className="font-mono">{isMac() ? "⌘" : "Ctrl"}+K</span>
      </div>
      </Command>
    </CommandDialog>
  );
}

// Helper exportado para abrir a pesquisa a partir de qualquer botão.
export function openGlobalSearch() {
  window.dispatchEvent(new Event("fbr-open-search"));
}
