// ============================================================
// Negrito nas mensagens sugeridas — um marcador, dois destinos
// ============================================================
// A Maria queria destacar a negrito o essencial (valores, datas, prazos)
// sem ter de andar a apagar asteriscos depois de colar. O problema é que
// cada destino entende uma coisa diferente:
//
//   • WhatsApp → *asterisco simples* é negrito nativo. `**assim**` fica
//     a negrito MAS com um asterisco a sobrar de cada lado — exactamente
//     a chatice que ela descreveu.
//   • Gmail → não interpreta asteriscos nenhuns. Colar `**assim**` mostra
//     os asteriscos tal e qual. Só o que vai para a área de transferência
//     como HTML (`text/html`) é que cola a negrito a sério.
//
// Por isso o assistente escreve sempre no marcador canónico `**texto**`
// e é aqui que se converte para cada destino:
//
//   WhatsApp (copiar / wa.me) → `*texto*`
//   Email (copiar)            → HTML com <b>; o texto simples que vai
//                               junto não leva marcadores nenhuns
//   mailto:                   → texto simples (o mailto não leva formato)
// ============================================================

/** `**assim**` — o marcador canónico que o assistente é instruído a usar. */
const DOUBLE = /\*\*([^*\n]+?)\*\*/g;
/**
 * `*assim*` — negrito do WhatsApp. As guardas `(?<![*\w])` / `(?![*\w])`
 * garantem que um `**duplo**` nunca é apanhado aqui, e que um asterisco
 * colado a letras (3*4) fica quieto.
 */
const SINGLE = /(?<![*\w])\*(?!\s)([^*\n]+?)(?<!\s)\*(?![*\w])/g;

/**
 * Uniformiza o negrito no marcador canónico `**texto**`, mesmo que o
 * modelo tenha respondido em sintaxe de WhatsApp. Corre à saída da API
 * para o resto da app poder assumir um formato só.
 */
export function normalizeBold(text: string): string {
  return text.replace(SINGLE, "**$1**");
}

/** Sintaxe do WhatsApp: `**x**` passa a `*x*`. */
export function boldForWhatsapp(text: string): string {
  return normalizeBold(text).replace(DOUBLE, "*$1*");
}

/** Tira os marcadores todos — para o `mailto:` e para o `text/plain`. */
export function stripBold(text: string): string {
  return normalizeBold(text).replace(DOUBLE, "$1");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * HTML para a área de transferência do email: negrito a sério e quebras
 * de linha preservadas. Escapa antes de converter, para que um `<` escrito
 * pelo cliente não vire markup.
 */
export function boldToHtml(text: string): string {
  const escapado = escapeHtml(normalizeBold(text));
  // O escape não toca nos asteriscos, por isso o marcador sobrevive.
  return escapado.replace(DOUBLE, "<b>$1</b>").split("\n").join("<br>");
}
