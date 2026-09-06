// ============================================================
// Transcript com tempos + regra de saudação
// ============================================================
// O assistente recebia a conversa sem horas nem data, e não sabia que
// horas eram "agora". Resultado: cumprimentava ("Boa tarde Ana 🌷") em
// TODAS as respostas, mesmo com a cliente a escrever há 2 minutos, e
// não distinguia uma troca em curso de uma conversa retomada dias depois.
//
// Este módulo põe em cada mensagem a hora de Lisboa e a distância até
// agora ("há 2 min", "ontem", "há 12 dias") e decide, em código, se a
// próxima mensagem leva saudação. A decisão vai escrita no prompt: é
// mais fiável do que esperar que o modelo a deduza das horas.
// ============================================================

import { formatDateTimeLisbon, lisbonDayKey } from "@/lib/format-date";

export interface TranscriptMessage {
  direction: "received" | "sent_echo";
  content_type: string;
  text: string | null;
  received_at: string;
}

// Conversa "em curso": a última mensagem (de qualquer lado) tem menos
// do que isto. Passado este intervalo, ou mudando o dia, volta a valer
// a saudação normal. 3 h é o que separa "ainda estamos a falar" de
// "retomar mais logo" numa conversa de WhatsApp.
export const SAUDACAO_JANELA_MS = 3 * 60 * 60 * 1000;

/** "agora mesmo" / "há 5 min" / "há 3 h" / "ontem" / "há 12 dias". */
export function intervaloHumano(fromIso: string, now: Date): string {
  const from = new Date(fromIso);
  if (Number.isNaN(from.getTime())) return "";
  const ms = Math.max(0, now.getTime() - from.getTime());
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24 && lisbonDayKey(from) === lisbonDayKey(now)) return `há ${horas} h`;
  const ontem = new Date(now.getTime() - 86_400_000);
  if (lisbonDayKey(from) === lisbonDayKey(ontem)) return "ontem";
  const dias = Math.round(ms / 86_400_000);
  return `há ${dias} dias`;
}

/**
 * Conversa pronta para o prompt, uma mensagem por linha, com data/hora
 * de Lisboa e a distância até agora. Vazio se não houver mensagens.
 */
export function transcriptComTempos(
  msgs: TranscriptMessage[],
  now: Date,
): string {
  return msgs
    .map((m) => {
      const tag = m.direction === "received" ? "CLIENTE" : "FBR";
      const content = m.text || `(${m.content_type})`;
      const quando = formatDateTimeLisbon(m.received_at);
      const dist = intervaloHumano(m.received_at, now);
      return `[${quando}${dist ? ` · ${dist}` : ""}] ${tag}: ${content}`;
    })
    .join("\n");
}

/**
 * A próxima mensagem leva saudação? Não, se a conversa está em curso:
 * última mensagem há menos de SAUDACAO_JANELA_MS e no mesmo dia (Lisboa).
 * Sem mensagens, ou depois de um intervalo, sim.
 */
export function levaSaudacao(msgs: TranscriptMessage[], now: Date): boolean {
  const ultima = msgs[msgs.length - 1];
  if (!ultima) return true;
  const t = new Date(ultima.received_at);
  if (Number.isNaN(t.getTime())) return true;
  if (now.getTime() - t.getTime() >= SAUDACAO_JANELA_MS) return true;
  return lisbonDayKey(t) !== lisbonDayKey(now);
}

/** Texto da regra de saudação para o prompt, já decidida em código. */
export function regraSaudacao(msgs: TranscriptMessage[], now: Date): string {
  if (levaSaudacao(msgs, now)) {
    return "Saudação: SIM. Passou tempo desde a última troca (ou é a primeira mensagem), por isso abre com a saudação habitual e o primeiro nome.";
  }
  const ultima = msgs[msgs.length - 1];
  const dist = intervaloHumano(ultima.received_at, now);
  return `Saudação: NÃO. A conversa está em curso (última mensagem ${dist}). Já nos cumprimentámos hoje: começa directamente pelo conteúdo, sem "Olá", "Boa tarde", nem repetir o nome na abertura. Responde como quem continua a falar.`;
}
