"use client";

import { MapPin } from "lucide-react";
import type { Partner } from "@/types/partner";
import {
  PARTNER_STATUS_DOT,
  PARTNER_STATUS_LABELS,
  PARTNER_STATUS_ORDER,
} from "@/types/partner";

// ── Limites geográficos de Portugal continental ──────────────
// (espaço para algumas ilhas próximas — para já só continente)
const LAT_NORTH = 42.20;
const LAT_SOUTH = 36.85;
const LON_WEST = -9.55;
const LON_EAST = -6.15;

// Dimensões do viewBox (aspect ratio aproximado do continente)
const W = 100;
const H = 170;

function project(lat: number, lon: number) {
  const x = ((lon - LON_WEST) / (LON_EAST - LON_WEST)) * W;
  const y = ((LAT_NORTH - lat) / (LAT_NORTH - LAT_SOUTH)) * H;
  return { x, y };
}

// Silhueta simplificada do continente português.
// Path obtido a partir de pontos aproximados da costa + fronteira leste.
// Não é cartograficamente preciso mas é facilmente reconhecível.
const PORTUGAL_PATH = (() => {
  // Sequência de pontos (lat, lon) que tracejam a fronteira no sentido
  // horário, começando no norte da costa.
  const points: Array<[number, number]> = [
    // Costa norte (oeste)
    [41.85, -8.87], [41.50, -8.80], [41.15, -8.66],
    [40.80, -8.65], [40.40, -8.74], [40.00, -8.86],
    [39.60, -9.02], [39.35, -9.38], [38.90, -9.50],
    // Volta da Lisboa / Cabo da Roca
    [38.78, -9.50], [38.65, -9.30], [38.45, -8.93],
    // Costa do Alentejo
    [38.10, -8.79], [37.70, -8.80], [37.30, -8.85],
    [37.10, -8.95], [36.97, -8.79],
    // Algarve sul
    [36.95, -8.30], [36.96, -7.85], [36.99, -7.40],
    // Sul → leste (Guadiana)
    [37.18, -7.40], [37.50, -7.45], [37.85, -7.42],
    // Fronteira leste a subir
    [38.20, -7.18], [38.55, -6.95], [38.90, -7.10],
    [39.20, -7.45], [39.45, -7.40], [39.65, -7.13],
    [39.80, -6.90], [40.00, -6.90], [40.20, -7.05],
    [40.45, -7.10], [40.65, -6.85], [40.85, -6.80],
    [41.10, -6.60], [41.30, -6.55], [41.50, -6.20],
    [41.70, -6.55], [41.85, -6.65],
    // Fronteira norte
    [41.95, -7.20], [41.90, -7.95], [41.95, -8.30], [41.90, -8.65],
    // Fecho
    [41.85, -8.87],
  ];
  return points
    .map(([lat, lon], i) => {
      const { x, y } = project(lat, lon);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ") + " Z";
})();

// Cidades de referência para enquadrar o utilizador
const REFERENCE_CITIES: Array<{ name: string; lat: number; lon: number }> = [
  { name: "Porto", lat: 41.15, lon: -8.61 },
  { name: "Coimbra", lat: 40.21, lon: -8.43 },
  { name: "Lisboa", lat: 38.72, lon: -9.14 },
  { name: "Évora", lat: 38.57, lon: -7.91 },
  { name: "Faro", lat: 37.02, lon: -7.93 },
];

export interface PortugalMapProps {
  partners: Partner[];
  onSelect?: (partner: Partner) => void;
  selectedId?: string | null;
  className?: string;
}

export default function PortugalMap({ partners, onSelect, selectedId, className }: PortugalMapProps) {
  // Apenas parceiros com coordenadas
  const located = partners.filter(
    (p) => p.latitude !== null && p.longitude !== null,
  );
  const unlocated = partners.length - located.length;

  return (
    <div className={`flex gap-6 ${className ?? ""}`}>
      {/* SVG Mapa */}
      <div className="relative flex-1 min-w-0">
        <svg
          viewBox={`-4 -4 ${W + 8} ${H + 8}`}
          className="w-full max-w-[420px] mx-auto"
          aria-label="Mapa de parceiros em Portugal"
        >
          {/* Sombra */}
          <path
            d={PORTUGAL_PATH}
            fill="rgb(245, 240, 232)"
            stroke="rgb(232, 224, 213)"
            strokeWidth="0.6"
            transform="translate(0.8, 0.8)"
            opacity="0.5"
          />
          {/* Continente */}
          <path
            d={PORTUGAL_PATH}
            fill="white"
            stroke="rgb(196, 168, 130)"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />

          {/* Cidades de referência */}
          {REFERENCE_CITIES.map((c) => {
            const { x, y } = project(c.lat, c.lon);
            return (
              <g key={c.name} opacity="0.5">
                <circle cx={x} cy={y} r="0.7" fill="rgb(184, 169, 154)" />
                <text
                  x={x + 1.5}
                  y={y + 0.6}
                  fontSize="2.5"
                  fill="rgb(139, 115, 85)"
                  fontFamily="system-ui, sans-serif"
                >
                  {c.name}
                </text>
              </g>
            );
          })}

          {/* Parceiros */}
          {located.map((p) => {
            const { x, y } = project(p.latitude!, p.longitude!);
            const isSelected = selectedId === p.id;
            const dotColor = PARTNER_STATUS_DOT[p.status]
              .replace("bg-", "")
              .split(" ")[0];
            // Mapa de bg-* tailwind para hex aproximados
            const fill = COLOR_MAP[dotColor] ?? "#64748b";
            return (
              <g key={p.id}>
                {isSelected && (
                  <circle cx={x} cy={y} r="4" fill={fill} opacity="0.25" />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? "2.4" : "1.8"}
                  fill={fill}
                  stroke="white"
                  strokeWidth="0.5"
                  className="cursor-pointer transition-all hover:r-2.5"
                  onClick={() => onSelect?.(p)}
                >
                  <title>
                    {p.name} — {PARTNER_STATUS_LABELS[p.status]}
                    {p.location_label ? `\n${p.location_label}` : ""}
                  </title>
                </circle>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legenda + lista de não-localizados */}
      <div className="w-44 shrink-0 space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[#8B7355] mb-2">
            Estado
          </div>
          <div className="space-y-1">
            {PARTNER_STATUS_ORDER.map((s) => {
              const count = located.filter((p) => p.status === s).length;
              return (
                <div key={s} className="flex items-center gap-2 text-xs">
                  <span className={`h-2.5 w-2.5 rounded-full ${PARTNER_STATUS_DOT[s]}`} />
                  <span className="flex-1 text-[#3D2B1F]">{PARTNER_STATUS_LABELS[s]}</span>
                  <span className="text-[#B8A99A] tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {unlocated > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            <div className="flex items-center gap-1.5 font-medium mb-1">
              <MapPin className="h-3 w-3" />
              {unlocated} parceiro{unlocated !== 1 ? "s" : ""} sem coordenadas
            </div>
            <p className="text-amber-700/80 leading-snug">
              Adiciona latitude e longitude no workbench para aparecerem no mapa.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Mapa simples de cores Tailwind → hex (apenas as usadas em PARTNER_STATUS_DOT)
const COLOR_MAP: Record<string, string> = {
  "slate-400":   "#94a3b8",
  "amber-500":   "#f59e0b",
  "orange-500":  "#f97316",
  "sky-500":     "#0ea5e9",
  "emerald-500": "#10b981",
  "rose-400":    "#fb7185",
};
