"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { Input } from "@/components/ui/input";
import { MapPin } from "lucide-react";

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
  const elementRef = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  // onChange pode mudar entre renders; mantemos referência sempre actual
  // para o listener (registado uma única vez na criação do elemento).
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [enabled, setEnabled] = useState<boolean>(!!GOOGLE_MAPS_KEY);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Cria o elemento PlaceAutocompleteElement uma vez por (enabled, country).
  useEffect(() => {
    if (!enabled || !containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;

    loadPlaces()
      .then(() => {
        if (cancelled || !container) return;
        // PlaceAutocompleteElement não está exposto em PlacesLibrary nos
        // @types actuais (3.64) — acedemos directamente à namespace global,
        // garantidamente carregada por loadPlaces().
        const el = new google.maps.places.PlaceAutocompleteElement({
          includedRegionCodes: country ? [country] : null,
          requestedLanguage: "pt",
          requestedRegion: country?.toUpperCase() ?? "PT",
        });
        if (placeholder) el.placeholder = placeholder;
        if (id) el.id = id;
        el.value = value;

        // Selecção de uma sugestão → buscar morada completa via fetchFields.
        el.addEventListener("gmp-select", async (e: google.maps.places.PlacePredictionSelectEvent) => {
          try {
            const place = e.placePrediction.toPlace();
            await place.fetchFields({ fields: ["formattedAddress"] });
            const addr =
              place.formattedAddress ??
              e.placePrediction.text?.text ??
              "";
            if (addr) onChangeRef.current(addr);
          } catch (err) {
            console.warn("[AddressAutocomplete] fetchFields falhou:", err);
            const fallback = e.placePrediction.text?.text ?? "";
            if (fallback) onChangeRef.current(fallback);
          }
        });

        // Texto livre (sem selecção): propaga `el.value` para o pai.
        // `input` é disparado pelo input interno e atravessa o shadow boundary.
        el.addEventListener("input", () => {
          onChangeRef.current(el.value);
        });

        container.appendChild(el);
        elementRef.current = el;
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[AddressAutocomplete] Maps falhou — fallback para input simples:", err);
          setEnabled(false);
          setLoadError(err instanceof Error ? err.message : "Erro a carregar Maps");
        }
      });

    return () => {
      cancelled = true;
      if (elementRef.current) {
        elementRef.current.remove();
        elementRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, country]);

  // Sincronização externa value → element.value. Necessário tocar no DOM
  // (.value) → tem de ser em effect, não no render (refs não acessíveis aí).
  useEffect(() => {
    const el = elementRef.current;
    if (el && el.value !== value) {
      el.value = value;
    }
  }, [value]);

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
    <div className="space-y-1">
      <div
        ref={containerRef}
        className={`fbr-place-autocomplete relative ${className ?? ""}`}
      >
        <MapPin
          className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500 pointer-events-none z-10"
          aria-hidden
        />
      </div>
      {hint && (
        <p className="text-[10px] text-cocoa-500 italic px-1">{hint}</p>
      )}
    </div>
  );
}
