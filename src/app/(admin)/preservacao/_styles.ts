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
  Paintbrush,
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
  a_finalizar_quadro:     "bg-cyan-100 text-cyan-900 border-cyan-300",
  a_ser_emoldurado:       "bg-teal-100 text-teal-900 border-teal-300",
  emoldurado:             "bg-emerald-100 text-emerald-900 border-emerald-300",
  a_ser_fotografado:      "bg-lime-100 text-lime-900 border-lime-300",
  quadro_pronto:          "bg-yellow-100 text-yellow-900 border-yellow-300",
  quadro_enviado:         "bg-orange-100 text-orange-900 border-orange-300",
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
  a_finalizar_quadro:     "bg-cyan-400",
  a_ser_emoldurado:       "bg-teal-400",
  emoldurado:             "bg-emerald-400",
  a_ser_fotografado:      "bg-lime-400",
  quadro_pronto:          "bg-yellow-400",
  quadro_enviado:         "bg-orange-400",
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
  a_finalizar_quadro:     Paintbrush,
  a_ser_emoldurado:       Hammer,
  emoldurado:             Frame,
  a_ser_fotografado:      Camera,
  quadro_pronto:          Sparkles,
  quadro_enviado:         Truck,
  quadro_recebido:        PartyPopper,
  cancelado:              Ban,
};

// Salvaguarda em tempo de compilação: cada OrderStatus tem de declarar
// aqui em que secção do dropdown aparece. Se um estado novo for
// adicionado a `OrderStatus` e esquecido neste Record, o TypeScript
// queixa-se (não compila). Não substituir por `Partial<Record<…>>` —
// a exaustividade é o que protege contra estados que ficam invisíveis.
type StatusGroupLabel =
  | "Pré-reserva"
  | "Reservas"
  | "Preservação e design"
  | "Finalização"
  | "Concluído"
  | "Cancelado";

const STATUS_TO_GROUP_LABEL: Record<OrderStatus, StatusGroupLabel> = {
  entrega_flores_agendar: "Pré-reserva",
  entrega_agendada:       "Reservas",
  flores_enviadas:        "Reservas",
  flores_recebidas:       "Reservas",
  flores_na_prensa:       "Preservação e design",
  reconstrucao_botanica:  "Preservação e design",
  a_compor_design:        "Preservação e design",
  a_aguardar_aprovacao:   "Preservação e design",
  a_finalizar_quadro:     "Preservação e design",
  a_ser_emoldurado:       "Finalização",
  emoldurado:             "Finalização",
  a_ser_fotografado:      "Finalização",
  quadro_pronto:          "Finalização",
  quadro_enviado:         "Finalização",
  quadro_recebido:        "Concluído",
  cancelado:              "Cancelado",
};

// Ordem deliberada dos grupos no dropdown e na vista de tabela.
const GROUP_LABEL_ORDER: StatusGroupLabel[] = [
  "Pré-reserva",
  "Reservas",
  "Preservação e design",
  "Finalização",
  "Concluído",
  "Cancelado",
];

// Derivado do Record acima — não editar à mão. Adicionar um estado novo
// faz-se em `STATUS_TO_GROUP_LABEL`.
export const STATUS_GROUPS: Array<{ label: StatusGroupLabel; statuses: OrderStatus[] }> =
  GROUP_LABEL_ORDER.map((label) => ({
    label,
    statuses: (Object.keys(STATUS_TO_GROUP_LABEL) as OrderStatus[]).filter(
      (s) => STATUS_TO_GROUP_LABEL[s] === label,
    ),
  }));

// Gradiente vermelho → âmbar → lime → verde, conforme a quantia já paga
export const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  "100_pago":      "bg-green-100 text-green-800 border-green-300",
  "70_pago":       "bg-lime-100 text-lime-800 border-lime-300",
  "30_pago":       "bg-amber-100 text-amber-900 border-amber-300",
  "100_por_pagar": "bg-red-100 text-red-700 border-red-300",
};

export const PAYMENT_DOT_COLORS: Record<PaymentStatus, string> = {
  "100_pago":      "bg-green-500",
  "70_pago":       "bg-lime-500",
  "30_pago":       "bg-amber-500",
  "100_por_pagar": "bg-red-600",
};
