"use client";

// ============================================================
// Componente de autocomplete de morada usando o Nominatim
// (OpenStreetMap). Gratuito, sem API key. Limita-se a 1 request
// por segundo conforme a política do Nominatim — debounce de 400ms
// no input cobre o uso típico.
//
// Devolve `{ label, latitude, longitude }` ao escolher um resultado.
// O label corresponde ao `display_name` do Nominatim (já legível em
// português quando o utilizador define `Accept-Language: pt`).
// ============================================================

import { useState, useEffect, useRef, useMemo } from "react";
import { MapPin, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  address?: Record<string, string>;
}

export interface AddressSelection {
  label: string;
  latitude: number;
  longitude: number;
}

interface Props {
  value: string | null;
  onSelect: (selection: AddressSelection) => void;
  onClear?: () => void;
  placeholder?: string;
  // Limitar a este código de país (default "pt"). Passar vazio para mundo.
  countryCode?: string;
  className?: string;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export function AddressAutocomplete({
  value,
  onSelect,
  onClear,
  placeholder = "Procura por morada, cidade…",
  countryCode = "pt",
  className,
}: Props) {
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sincronização externa value → query usando o "store info from previous
  // renders" pattern (https://react.dev/learn/you-might-not-need-an-effect).
  // Em vez de useEffect+setState (que viola react-hooks/set-state-in-effect),
  // comparamos com o último value conhecido durante o render.
  const [lastValue, setLastValue] = useState<string | null>(value);
  if (lastValue !== value) {
    setLastValue(value);
    setQuery(value ?? "");
  }

  const trimmed = query.trim();
  const tooShort = trimmed.length < 3;
  const matchesValue = trimmed === (value ?? "").trim();

  // Results visíveis: derivados — não mostramos results "obsoletos" quando
  // o utilizador apagou a query ou ela ainda é curta.
  const displayResults = useMemo<NominatimResult[]>(
    () => (tooShort ? [] : results),
    [tooShort, results],
  );

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search — só chama setState dentro do callback async (não no body).
  useEffect(() => {
    if (tooShort || matchesValue) return;

    const handle = setTimeout(async () => {
      // Cancela request anterior se existir
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const params = new URLSearchParams({
        q: trimmed,
        format: "json",
        addressdetails: "1",
        limit: "6",
      });
      if (countryCode) params.set("countrycodes", countryCode);

      try {
        const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
          signal: controller.signal,
          headers: { "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.5" },
        });
        if (!res.ok) {
          setResults([]);
          setLoading(false);
          return;
        }
        const data = (await res.json()) as NominatimResult[];
        setResults(data);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [query, value, countryCode, tooShort, matchesValue, trimmed]);

  function handleSelect(result: NominatimResult) {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    onSelect({ label: result.display_name, latitude: lat, longitude: lon });
    setQuery(result.display_name);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B8A99A] pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            const trimmedNext = next.trim();
            if (trimmedNext.length >= 3 && trimmedNext !== (value ?? "").trim()) {
              setLoading(true);
              setOpen(true);
            } else {
              setLoading(false);
            }
          }}
          onFocus={() => {
            if (displayResults.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          className="pl-8 pr-8"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#B8A99A] animate-spin" />
        )}
        {!loading && value && onClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
              onClear();
            }}
            title="Limpar"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {open && displayResults.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto rounded-md border border-[#E8E0D5] dark:border-[#2C2C2E] bg-white dark:bg-[#141414] shadow-lg">
          {displayResults.map((r) => (
            <button
              key={r.place_id}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2 hover:bg-[#FAF8F5] dark:hover:bg-[#1A1A1A] border-b border-[#F0EAE0] dark:border-[#1F1F1F] last:border-0 flex items-start gap-2"
            >
              <MapPin className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-[#3D2B1F] dark:text-[#E8D5B5] truncate">
                  {r.display_name}
                </div>
                <div className="text-[10px] text-[#B8A99A] tabular-nums">
                  {parseFloat(r.lat).toFixed(4)}, {parseFloat(r.lon).toFixed(4)}
                </div>
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-[#B8A99A] italic border-t border-[#F0EAE0] dark:border-[#1F1F1F]">
            Resultados de OpenStreetMap (Nominatim)
          </div>
        </div>
      )}

      {open && !loading && trimmed.length >= 3 && displayResults.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-[#E8E0D5] dark:border-[#2C2C2E] bg-white dark:bg-[#141414] shadow-lg p-3 text-xs text-[#8B7355]">
          Sem resultados para &ldquo;{query}&rdquo;.
        </div>
      )}
    </div>
  );
}
