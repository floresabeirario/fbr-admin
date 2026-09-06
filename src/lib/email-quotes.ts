// ============================================================
// Cortar as citações dos emails
// ============================================================
// Numa conversa com 6 respostas, o último email traz lá dentro os 5
// anteriores citados. No workbench isso dava lençóis de texto onde a
// resposta nova — a única coisa que interessa — eram três linhas no topo.
//
// Esta função separa "o que a pessoa escreveu agora" do "resto citado".
// O painel mostra o primeiro e esconde o segundo atrás de um "mostrar
// texto citado"; o assistente do Claude só recebe o primeiro (senão
// gastava tokens a reler cinco vezes a mesma coisa).
//
// Nunca deita nada fora: quando não reconhece o padrão, ou quando cortar
// deixaria a mensagem vazia, devolve o corpo inteiro como visível.
// ============================================================

/** "On Tue, 2 Sep 2026 at 10:04, Maria <m@x.pt> wrote:" (e o "Em ... escreveu:"). */
const ATRIBUICAO = /^\s*(?:on|em)\b.*\b(?:wrote|escreveu)\s*:\s*$/i;
/** A mesma linha quando o cliente de email a parte em duas. */
const ATRIBUICAO_PARTIDA = /^\s*(?:on|em)\b[^\n]{0,160}$/i;
const ATRIBUICAO_FIM = /\b(?:wrote|escreveu)\s*:\s*$/i;
/** Outlook e reencaminhamentos. */
const SEPARADOR = /^\s*-{2,}\s*(?:original message|mensagem original|forwarded message|mensagem reencaminhada|mensaje original)\s*-{2,}\s*$/i;
const LINHA_OUTLOOK = /^\s*_{10,}\s*$/;
/** Cabeçalho de citação do Outlook: "De: Maria <m@x.pt>". */
const CABECALHO_DE = /^\s*(?:de|from)\s*:\s*.+<.+@.+>/i;

function ehInicioDeCitacao(linha: string, seguinte: string | undefined): boolean {
  if (/^\s*>/.test(linha)) return true;
  if (ATRIBUICAO.test(linha)) return true;
  if (SEPARADOR.test(linha)) return true;
  if (LINHA_OUTLOOK.test(linha)) return true;
  if (CABECALHO_DE.test(linha)) return true;
  // "On ..." partido em duas linhas: só conta se a linha seguinte fechar
  // com "wrote:"/"escreveu:". Assim uma frase começada por "Em" não corta
  // a mensagem a meio.
  return ATRIBUICAO_PARTIDA.test(linha) && seguinte !== undefined && ATRIBUICAO_FIM.test(seguinte);
}

export interface EmailSemCitacoes {
  /** O que foi escrito agora. */
  visible: string;
  /** Tudo o que vinha citado por baixo (string vazia quando não há). */
  quoted: string;
}

export function splitQuotedEmail(body: string): EmailSemCitacoes {
  const texto = (body ?? "").replace(/\r\n/g, "\n");
  const linhas = texto.split("\n");

  let corte = -1;
  for (let i = 0; i < linhas.length; i++) {
    if (ehInicioDeCitacao(linhas[i], linhas[i + 1])) {
      corte = i;
      break;
    }
  }

  if (corte < 0) return { visible: texto.trim(), quoted: "" };

  const visible = linhas.slice(0, corte).join("\n").trim();
  const quoted = linhas.slice(corte).join("\n").trim();

  // Cortar até não sobrar nada é pior do que não cortar: acontece quando a
  // pessoa responde por baixo da citação, ou quando o padrão apanhou a
  // primeira linha por engano.
  if (visible.length < 2) return { visible: texto.trim(), quoted: "" };

  return { visible, quoted };
}
