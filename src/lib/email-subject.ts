// ============================================================
// Assunto do email sugerido
// ============================================================
// O assistente devolve o email com o assunto na primeira linha
// ("Assunto: ..." em PT, "Subject: ..." em EN) para a Maria o poder
// editar como o resto do texto, numa caixa só. Na hora de abrir o
// programa de email é preciso separá-lo outra vez, porque o assunto vai
// noutro campo do `mailto:`.
//
// Degrada bem de propósito: se o modelo não puser a linha do assunto (ou
// a puser em negrito, com markdown), devolve-se o texto inteiro como
// corpo. Um email sem assunto é chato; um email a que se comeu a
// primeira frase é pior.
// ============================================================

export interface EmailComAssunto {
  subject: string | null;
  body: string;
}

export function splitAssunto(texto: string): EmailComAssunto {
  const m = /^\s*(?:assunto|subject)\s*:\s*(.+)\r?\n+/i.exec(texto);
  if (!m) return { subject: null, body: texto };
  return { subject: m[1].trim(), body: texto.slice(m[0].length) };
}
