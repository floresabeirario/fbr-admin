// Cores e ícones partilhados entre vistas (tabela, cards, calendário, timeline)
import {
  CalendarClock,
  CalendarCheck,
  Send,
  PackageCheck,
  Layers,
  Flower2,
  Palette,
  Hourglass,
  Hammer,
  Frame,
  Camera,
  Sparkles,
  Truck,
  PartyPopper,
  Ban,
  type LucideIcon,
} from "lucide-react";
import type { OrderStatus, PaymentStatus } from "@/types/database";

export const STATUS_COLORS: Record<OrderStatus, string> = {
  entrega_flores_agendar: "bg-rose-100 text-rose-900 border-rose-300",
  entrega_agendada:       "bg-pink-100 text-pink-900 border-pink-300",
  flores_enviadas:        "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300",
  flores_recebidas:       "bg-purple-100 text-purple-900 border-purple-300",
  flores_na_prensa:       "bg-violet-100 text-violet-900 border-violet-300",
  reconstrucao_botanica:  "bg-indigo-100 text-indigo-900 border-indigo-300",
  a_compor_design:        "bg-blue-100 text-blue-900 border-blue-300",
  a_aguardar_aprovacao:   "bg-sky-100 text-sky-900 border-sky-300",
  a_ser_emoldurado:       "bg-cyan-100 text-cyan-900 border-cyan-300",
  emoldurado:             "bg-teal-100 text-teal-900 border-teal-300",
  a_ser_fotografado:      "bg-emerald-100 text-emerald-900 border-emerald-300",
  quadro_pronto:          "bg-lime-100 text-lime-900 border-lime-300",
  quadro_enviado:         "bg-yellow-100 text-yellow-900 border-yellow-300",
  quadro_recebido:        "bg-green-100 text-green-900 border-green-300",
  cancelado:              "bg-stone-200 text-stone-600 border-stone-300",
};

// Variante "dot" para usar como bolinha colorida (pequena, sem borda)
export const STATUS_DOT_COLORS: Record<OrderStatus, string> = {
  entrega_flores_agendar: "bg-rose-400",
  entrega_agendada:       "bg-pink-400",
  flores_enviadas:        "bg-fuchsia-400",
  flores_recebidas:       "bg-purple-400",
  flores_na_prensa:       "bg-violet-400",
  reconstrucao_botanica:  "bg-indigo-400",
  a_compor_design:        "bg-blue-400",
  a_aguardar_aprovacao:   "bg-sky-400",
  a_ser_emoldurado:       "bg-cyan-400",
  emoldurado:             "bg-teal-400",
  a_ser_fotografado:      "bg-emerald-400",
  quadro_pronto:          "bg-lime-400",
  quadro_enviado:         "bg-yellow-400",
  quadro_recebido:        "bg-green-500",
  cancelado:              "bg-stone-400",
};

export const STATUS_ICONS: Record<OrderStatus, LucideIcon> = {
  entrega_flores_agendar: CalendarClock,
  entrega_agendada:       CalendarCheck,
  flores_enviadas:        Send,
  flores_recebidas:       PackageCheck,
  flores_na_prensa:       Layers,
  reconstrucao_botanica:  Flower2,
  a_compor_design:        Palette,
  a_aguardar_aprovacao:   Hourglass,
  a_ser_emoldurado:       Hammer,
  emoldurado:             Frame,
  a_ser_fotografado:      Camera,
  quadro_pronto:          Sparkles,
  quadro_enviado:         Truck,
  quadro_recebido:        PartyPopper,
  cancelado:              Ban,
};

export const STATUS_GROUPS: Array<{ label: string; statuses: OrderStatus[] }> = [
  { label: "Pré-reserva",         statuses: ["entrega_flores_agendar"] },
  { label: "Reservas",            statuses: ["entrega_agendada", "flores_enviadas", "flores_recebidas"] },
  { label: "Preservação e design", statuses: ["flores_na_prensa", "reconstrucao_botanica", "a_compor_design", "a_aguardar_aprovacao"] },
  { label: "Finalização",         statuses: ["a_ser_emoldurado", "emoldurado", "a_ser_fotografado", "quadro_pronto", "quadro_enviado"] },
  { label: "Concluído",           statuses: ["quadro_recebido"] },
  { label: "Cancelado",           statuses: ["cancelado"] },
];

export const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  "100_pago":      "bg-green-100 text-green-800 border-green-300",
  "70_pago":       "bg-yellow-100 text-yellow-800 border-yellow-300",
  "30_pago":       "bg-yellow-100 text-yellow-800 border-yellow-300",
  "30_por_pagar":  "bg-red-100 text-red-700 border-red-300",
  "100_por_pagar": "bg-red-100 text-red-700 border-red-300",
};

export const PAYMENT_DOT_COLORS: Record<PaymentStatus, string> = {
  "100_pago":      "bg-green-500",
  "70_pago":       "bg-yellow-500",
  "30_pago":       "bg-yellow-500",
  "30_por_pagar":  "bg-red-500",
  "100_por_pagar": "bg-red-600",
};
