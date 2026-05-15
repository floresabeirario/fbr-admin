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
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [enabled, setEnabled] = useState<boolean>(!!GOOGLE_MAPS_KEY);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !inputRef.current) return;
    let cancelled = false;

    loadPlaces()
      .then((places) => {
        if (cancelled || !inputRef.current) return;
        const ac = new places.Autocomplete(inputRef.current, {
          fields: ["formatted_address", "name", "geometry"],
          componentRestrictions: { country },
          types: ["geocode"],
        });
        autocompleteRef.current = ac;
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          const addr = place.formatted_address ?? place.name ?? "";
          if (addr) onChange(addr);
        });
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
      if (autocompleteRef.current && typeof google !== "undefined" && google.maps) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
    // ESLint avisa sobre `onChange` mas só queremos rodar quando enabled/country mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, country]);

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
        {enabled && (
          <MapPin
            className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cocoa-500 pointer-events-none"
            aria-hidden
          />
        )}
      </div>
      {enabled && hint && (
        <p className="text-[10px] text-cocoa-500 italic px-1">{hint}</p>
      )}
      {!enabled && GOOGLE_MAPS_KEY && loadError && (
        <p className="text-[10px] text-amber-700 italic px-1">
          Maps indisponível ({loadError}). Escreve a morada manualmente.
        </p>
      )}
    </div>
  );
}
