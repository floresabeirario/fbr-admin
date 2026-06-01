// ============================================================
// Templates de abordagem a Figuras Públicas (seeding a noivas/influencers)
// ============================================================
// Mensagens-modelo curtas para DM/email. Auto-contidas (não usam a tabela
// message_templates, que está ligada a estados de encomenda). Variáveis
// substituídas no cliente: {nome}, {arroba}, {hashtag}.
// ============================================================

import type { TemplateLanguage } from "@/types/message-template";
import type { FigureStatus } from "@/types/public-figure";

export interface OutreachTemplate {
  slug: string;
  name: string;
  language: TemplateLanguage;
  body: string;
  // Estados em que esta mensagem faz sentido sugerir.
  suggested_statuses: FigureStatus[];
}

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  // ── 1º contacto ────────────────────────────────────────────
  {
    slug: "primeiro_contacto_pt",
    name: "1º contacto",
    language: "pt",
    suggested_statuses: ["por_contactar", "contactada"],
    body:
      "Olá {nome}! 🌸 Somos a Flores à Beira Rio e transformamos as flores de "
      + "momentos especiais em quadros de arte botânica que duram para sempre. "
      + "Vimos que está noiva — parabéns! 💍 Adorávamos oferecer-lhe a preservação "
      + "do seu ramo, sem qualquer custo, como cortesia. Faria sentido falarmos?",
  },
  {
    slug: "primeiro_contacto_en",
    name: "1st contact",
    language: "en",
    suggested_statuses: ["por_contactar", "contactada"],
    body:
      "Hi {nome}! 🌸 We're Flores à Beira Rio and we turn the flowers from "
      + "special moments into botanical art pieces that last forever. We saw you're "
      + "getting married — congratulations! 💍 We'd love to gift you the preservation "
      + "of your bouquet, completely free. Would you be open to chatting?",
  },
  // ── Follow-up (sem resposta) ───────────────────────────────
  {
    slug: "followup_pt",
    name: "Follow-up",
    language: "pt",
    suggested_statuses: ["contactada", "sem_resposta"],
    body:
      "Olá {nome}, só a reforçar o nosso carinho 🌷 A oferta de preservarmos o seu "
      + "ramo continua de pé. Se tiver curiosidade, mostramos-lhe exemplos do nosso "
      + "trabalho. Um beijinho da equipa Flores à Beira Rio!",
  },
  {
    slug: "followup_en",
    name: "Follow-up",
    language: "en",
    suggested_statuses: ["contactada", "sem_resposta"],
    body:
      "Hi {nome}, just a gentle nudge 🌷 Our offer to preserve your bouquet still "
      + "stands. If you're curious, we'd love to show you examples of our work. "
      + "Warm wishes from the Flores à Beira Rio team!",
  },
  // ── Brief / kit (combinar contrapartida) ───────────────────
  {
    slug: "brief_pt",
    name: "Brief / kit",
    language: "pt",
    suggested_statuses: ["aceitou", "em_producao"],
    body:
      "Que feliz por avançarmos, {nome}! 🌸 Quando partilhar, era só marcar-nos "
      + "{arroba} e usar {hashtag} para a vossa comunidade nos encontrar. "
      + "Combinamos a recolha das flores logo após o evento para ficarem perfeitas. "
      + "Qualquer dúvida, estamos aqui!",
  },
  // ── Agradecimento (depois de publicar) ─────────────────────
  {
    slug: "agradecimento_pt",
    name: "Agradecimento",
    language: "pt",
    suggested_statuses: ["concluida"],
    body:
      "Muito obrigada, {nome}! 💕 Adorámos a sua partilha e o carinho com que "
      + "falou de nós. Foi um prazer preservar as suas flores — que fiquem como "
      + "memória para a vida. Estaremos sempre por aqui!",
  },
  {
    slug: "agradecimento_en",
    name: "Thank you",
    language: "en",
    suggested_statuses: ["concluida"],
    body:
      "Thank you so much, {nome}! 💕 We loved your post and the kind words. It was "
      + "a joy to preserve your flowers — may they be a memory for life. We're always "
      + "here for you!",
  },
];

// Preenche as variáveis simples.
export function fillOutreachTemplate(
  body: string,
  vars: { nome?: string | null; arroba?: string | null; hashtag?: string | null },
): string {
  return body
    .replaceAll("{nome}", vars.nome?.trim() || "")
    .replaceAll("{arroba}", vars.arroba?.trim() || "@floresabeirario")
    .replaceAll("{hashtag}", vars.hashtag?.trim() || "#floresabeirario");
}
