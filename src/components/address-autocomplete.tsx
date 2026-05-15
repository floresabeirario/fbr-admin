"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  /** Restringir resultados a um país (ISO-3166-1 alpha-2). Default: "pt". */
  country?: string;
  /** Texto opcional mostrado em italic abaixo do input quando há chave. */
  hint?: string;
}

// Promessa partilhada — só configura/carrega 1x por sessão.
let placesPromise: Promise<google.maps.PlacesLibrary> | null = null;
function loadPlaces(): Promise<google.maps.PlacesLibrary> {
  if (!GOOGLE_MAPS_KEY) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_KEY não definida"));
  }
  if (!placesPromise) {
    setOptions({
      key: GOOGLE_MAPS_KEY,
      v: "weekly",
      language: "pt",
      region: "PT",
    });
    placesPromise = importLibrary("places");
  }
  return placesPromise;
}

interface Suggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  prediction: google.maps.places.PlacePrediction;
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder,
  className,
  id,
  country = "pt",
  hint,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [enabled, setEnabled] = useState<boolean>(!!GOOGLE_MAPS_KEY);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sincronização externa value → query (pattern "store info from previous renders").
  const [lastValue, setLastValue] = useState(value);
  if (lastValue !== value) {
    setLastValue(value);
    setQuery(value);
  }

  // Pré-carrega a biblioteca quando o componente monta para evitar latência no 1º caractere.
  useEffect(() => {
    if (!enabled) return;
    loadPlaces().catch((err) => {
      console.warn("[AddressAutocomplete] Maps falhou — fallback para input simples:", err);
      setEnabled(false);
      setLoadError(err instanceof Error ? err.message : "Erro a carregar Maps");
    });
  }, [enabled]);

  // Fecha dropdown ao clicar fora.
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

  // Filtragem derivada — não exibimos sugestões antigas quando a query é
  // demasiado curta ou bate com o valor já confirmado (evita dropdown logo
  // após selecionar uma).
  const trimmedQuery = query.trim();
  const tooShort = trimmedQuery.length < 3;
  const matchesValue = trimmedQuery === value.trim();
  const displayedSuggestions = tooShort || matchesValue ? [] : suggestions;

  // Pesquisa debounced — chama fetchAutocompleteSuggestions ao mudar query.
  useEffect(() => {
    if (!enabled) return;
    if (tooShort || matchesValue) return;

    let cancelled = false;

    const handle = setTimeout(async () => {
      try {
        const places = await loadPlaces();
        // Cria sessão token apenas quando começa uma nova pesquisa.
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new places.AutocompleteSessionToken();
        }
        const { suggestions: results } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: trimmedQuery,
            sessionToken: sessionTokenRef.current,
            includedRegionCodes: country ? [country] : undefined,
            language: "pt",
            region: country?.toUpperCase() ?? "PT",
          });
        if (cancelled) return;
        const mapped: Suggestion[] = results
          .map((s) => s.placePrediction)
          .filter((p): p is google.maps.places.PlacePrediction => p !== null)
          .map((p) => ({
            placeId: p.placeId,
            mainText: p.mainText?.text ?? p.text.text,
            secondaryText: p.secondaryText?.text ?? "",
            prediction: p,
          }));
        setSuggestions(mapped);
        setOpen(mapped.length > 0);
      } catch (err) {
        if (!cancelled) {
          console.warn("[AddressAutocomplete] fetchAutocompleteSuggestions falhou:", err);
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [trimmedQuery, country, enabled, tooShort, matchesValue]);

  async function handleSelect(suggestion: Suggestion) {
    setOpen(false);
    try {
      const place = suggestion.prediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress"] });
      const addr =
        place.formattedAddress ??
        [suggestion.mainText, suggestion.secondaryText].filter(Boolean).join(", ");
      setQuery(addr);
      onChangeRef.current(addr);
    } catch (err) {
      console.warn("[AddressAutocomplete] fetchFields falhou:", err);
      const fallback = [suggestion.mainText, suggestion.secondaryText]
        .filter(Boolean)
        .join(", ");
      setQuery(fallback);
      onChangeRef.current(fallback);
    } finally {
      // Sessão de billing termina após fetchFields — gerar novo token na próxima.
      sessionTokenRef.current = null;
    }
  }

  // Fallback sem chave/erro: input simples controlado.
  if (!enabled) {
    return (
      <div className="space-y-1">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
        {GOOGLE_MAPS_KEY && loadError && (
          <p className="text-[10px] text-amber-700 italic px-1">
            Maps indisponível ({loadError}). Escreve a morada manualmente.
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative space-y-1">
      <div className="relative">
        <Input
          id={id}
          value={query}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            // Eco para o pai mesmo sem selecção (mantém comportamento anterior).
            onChange(next);
            const t = next.trim();
            if (t.length >= 3 && t !== value.trim()) {
              setLoading(true);
              setOpen(true);
            } else {
              setLoading(false);
              setOpen(false);
            }
          }}
          onFocus={() => {
            if (displayedSuggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          className={(className ?? "") + " pr-7"}
          autoComplete="off"
        />
        {loading ? (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500 animate-spin pointer-events-none" />
        ) : (
          <MapPin
            className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500 pointer-events-none"
            aria-hidden
          />
        )}
      </div>

      {open && displayedSuggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto rounded-md border border-cream-200 bg-surface shadow-lg">
          {displayedSuggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 hover:bg-cream-50 border-b border-cream-100 last:border-0 flex items-start gap-2"
            >
              <MapPin className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-cocoa-900 truncate">{s.mainText}</div>
                {s.secondaryText && (
                  <div className="text-[11px] text-cocoa-500 truncate">
                    {s.secondaryText}
                  </div>
                )}
              </div>
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px] text-cocoa-500 italic border-t border-cream-100">
            Sugestões do Google Maps
          </div>
        </div>
      )}

      {hint && !open && (
        <p className="text-[10px] text-cocoa-500 italic px-1">{hint}</p>
      )}
    </div>
  );
}
