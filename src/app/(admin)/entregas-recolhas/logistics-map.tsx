"use client";

import { useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { Loader2, MapIcon } from "lucide-react";
import { differenceInDays, parseISO, startOfDay, format } from "date-fns";
import { pt } from "date-fns/locale";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
const CACHE_KEY = "fbr-geocode-cache-v1";

type GeocodeEntry = { lat: number; lng: number; at: number };
type GeocodeCache = Record<string, GeocodeEntry>;

export type MapKind = "recolha_evento" | "envio_ctt_flores" | "envio_ctt_quadro";

export interface MapMarker {
  id: string;
  kind: MapKind;
  date: string;
  location: string;
  timeFrom?: string | null;
  timeTo?: string | null;
  orderHref: string;
  orderRef: string;
  clientName: string;
  eventLabel?: string | null;
}

const KIND_LABEL_MAP: Record<MapKind, string> = {
  recolha_evento: "Recolha no local",
  envio_ctt_flores: "Envio CTT — flores",
  envio_ctt_quadro: "Envio CTT — quadro",
};

function readCache(): GeocodeCache {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function writeCache(c: GeocodeCache) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    // quota cheia — ignora
  }
}

// Carrega Maps + Geocoding 1x por sessão
let mapsPromise: Promise<{
  maps: google.maps.MapsLibrary;
  geocoding: google.maps.GeocodingLibrary;
}> | null = null;

function loadMaps() {
  if (!GOOGLE_MAPS_KEY) {
    return Promise.reject(new Error("NEXT_PUBLIC_GOOGLE_MAPS_KEY não definida"));
  }
  if (!mapsPromise) {
    setOptions({
      key: GOOGLE_MAPS_KEY,
      v: "weekly",
      language: "pt",
      region: "PT",
    });
    mapsPromise = Promise.all([
      importLibrary("maps"),
      importLibrary("geocoding"),
    ]).then(([maps, geocoding]) => ({ maps, geocoding }));
  }
  return mapsPromise;
}

function bucketStyle(date: string): {
  fill: string;
  stroke: string;
  bucket: "atrasada" | "hoje" | "amanha" | "semana" | "futuro";
} {
  const today = startOfDay(new Date());
  const d = parseISO(date);
  const diff = differenceInDays(startOfDay(d), today);
  if (diff < 0)
    return { fill: "#dc2626", stroke: "#7f1d1d", bucket: "atrasada" };
  if (diff === 0)
    return { fill: "#10b981", stroke: "#065f46", bucket: "hoje" };
  if (diff === 1)
    return { fill: "#f59e0b", stroke: "#92400e", bucket: "amanha" };
  if (diff <= 7)
    return { fill: "#3b82f6", stroke: "#1e40af", bucket: "semana" };
  return { fill: "#6b7280", stroke: "#1f2937", bucket: "futuro" };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c]!;
  });
}

function renderInfoWindow(m: MapMarker): string {
  const dateStr = format(parseISO(m.date), "EEEE, dd/MM/yyyy", { locale: pt });
  const time = m.timeFrom
    ? `${m.timeFrom.slice(0, 5)}${m.timeTo ? `–${m.timeTo.slice(0, 5)}` : ""}`
    : "";
  const kindLabel = KIND_LABEL_MAP[m.kind];
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 200px; max-width: 280px; padding: 4px 2px;">
      <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px; color: #1f2937;">
        ${escapeHtml(m.clientName)}
        <span style="font-family: monospace; font-size: 9px; text-transform: uppercase; background: #f3f4f6; color: #6b7280; padding: 1px 4px; border-radius: 4px; margin-left: 4px;">${escapeHtml(m.orderRef)}</span>
      </div>
      <div style="font-size: 11px; color: #4b5563; margin-bottom: 2px; text-transform: capitalize;">
        ${escapeHtml(dateStr)}${time ? ` · ${escapeHtml(time)}` : ""}
      </div>
      <div style="font-size: 11px; color: #4b5563; margin-bottom: 4px;">
        📍 ${escapeHtml(m.location)}
      </div>
      ${m.eventLabel ? `<div style="font-size: 10px; color: #6b7280; margin-bottom: 6px;">${escapeHtml(m.eventLabel)}</div>` : ""}
      <div style="font-size: 10px; color: #9ca3af; margin-bottom: 6px;">
        ${escapeHtml(kindLabel)}
      </div>
      <a href="${m.orderHref}" style="font-size: 11px; color: #2563eb; text-decoration: none; font-weight: 500;">
        Abrir encomenda →
      </a>
    </div>
  `;
}

export default function LogisticsMap({
  markers,
  height = 500,
}: {
  markers: MapMarker[];
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [status, setStatus] = useState<
    "loading" | "ready" | "error" | "no-key"
  >(GOOGLE_MAPS_KEY ? "loading" : "no-key");
  const [error, setError] = useState<string | null>(null);
  const [failedCount, setFailedCount] = useState(0);

  // Inicializa o mapa 1x
  useEffect(() => {
    if (!GOOGLE_MAPS_KEY) return;
    let cancelled = false;
    loadMaps()
      .then(({ maps }) => {
        if (cancelled || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: { lat: 39.5, lng: -8.0 }, // Portugal continental
          zoom: 7,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow();
        setStatus("ready");
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn("[LogisticsMap] Maps falhou:", err);
          setStatus("error");
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Redesenha marcadores sempre que `markers` mudar
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    const map = mapRef.current;
    let cancelled = false;

    // Limpa marcadores antigos
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const cache = readCache();
    const geocoder = new google.maps.Geocoder();
    const bounds = new google.maps.LatLngBounds();
    let placed = 0;
    let failed = 0;

    async function geocode(address: string): Promise<GeocodeEntry | null> {
      if (cache[address]) return cache[address];
      try {
        const res = await geocoder.geocode({
          address,
          region: "PT",
          componentRestrictions: { country: "pt" },
        });
        if (res.results.length === 0) return null;
        const loc = res.results[0].geometry.location;
        const entry: GeocodeEntry = {
          lat: loc.lat(),
          lng: loc.lng(),
          at: Date.now(),
        };
        cache[address] = entry;
        return entry;
      } catch (err) {
        console.warn("[LogisticsMap] geocode falhou:", address, err);
        return null;
      }
    }

    async function placeAll() {
      // Geocoda em série para ser educado com a API e o crédito grátis
      for (const m of markers) {
        if (cancelled) return;
        if (!m.location || m.location === "—") {
          failed++;
          continue;
        }
        const coords = await geocode(m.location);
        if (cancelled) return;
        if (!coords) {
          failed++;
          continue;
        }
        const { fill, stroke } = bucketStyle(m.date);
        const marker = new google.maps.Marker({
          map,
          position: { lat: coords.lat, lng: coords.lng },
          title: m.clientName,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: fill,
            fillOpacity: 0.95,
            strokeColor: stroke,
            strokeWeight: 2,
          },
        });
        marker.addListener("click", () => {
          if (!infoWindowRef.current) return;
          infoWindowRef.current.setContent(renderInfoWindow(m));
          infoWindowRef.current.open(map, marker);
        });
        markersRef.current.push(marker);
        bounds.extend({ lat: coords.lat, lng: coords.lng });
        placed++;
      }

      writeCache(cache);
      if (cancelled) return;
      setFailedCount(failed);
      if (placed === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(13);
      } else if (placed > 1) {
        map.fitBounds(bounds, 48);
      }
    }

    placeAll();
    return () => {
      cancelled = true;
    };
  }, [markers, status]);

  if (status === "no-key") {
    return (
      <div className="rounded-2xl border border-dashed border-cream-200 bg-cream-50 p-6 text-center text-xs text-cocoa-700">
        <MapIcon className="h-6 w-6 mx-auto mb-2 text-cocoa-500" />
        Mapa indisponível — falta configurar{" "}
        <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_KEY</code>.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl border border-cream-200 overflow-hidden bg-cream-50">
        <div ref={containerRef} style={{ width: "100%", height: `${height}px` }} />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-cream-50/80 text-xs text-cocoa-700">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            A carregar mapa…
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-cream-50 text-xs text-amber-700 italic p-4 text-center">
            Erro a carregar Maps: {error}
          </div>
        )}
        {status === "ready" && markers.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-cream-50/60 text-xs italic text-cocoa-500 pointer-events-none">
            Nenhum item para mostrar no mapa.
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-cocoa-700 px-1">
        <LegendDot color="#dc2626" label="Atrasada" />
        <LegendDot color="#10b981" label="Hoje" />
        <LegendDot color="#f59e0b" label="Amanhã" />
        <LegendDot color="#3b82f6" label="Esta semana" />
        <LegendDot color="#6b7280" label="Mais tarde" />
        {failedCount > 0 && (
          <span className="ml-auto italic text-cocoa-500">
            {failedCount} sem localização válida
          </span>
        )}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span
        className="h-2.5 w-2.5 rounded-full border border-cocoa-900/30 shrink-0"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}
