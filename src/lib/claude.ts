import Anthropic from "@anthropic-ai/sdk";

// Modelo em uso. Para trocar para Haiku (mais barato/rapido), basta mudar
// esta constante para "claude-haiku-4-5-20251001". Sonnet 4.6 e melhor para
// portugues europeu e tom de marca; Haiku e suficiente para respostas
// curtas.
export const CLAUDE_MODEL = "claude-sonnet-4-6";

// Precos por 1M tokens (USD), modelo claude-sonnet-4-6. Para o Haiku
// substituir por valores menores. Cost tracking usa estes valores.
export const CLAUDE_PRICING_USD = {
  input_per_million: 3,
  output_per_million: 15,
  cache_write_per_million: 3.75,
  cache_read_per_million: 0.30,
};

// EUR aproximado para display. Se conta da Anthropic estiver em USD,
// e isto so para Maria ver. Nao para faturacao precisa.
export const USD_TO_EUR = 0.92;

export type ClaudeUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

export function calculateClaudeCostUsd(usage: ClaudeUsage): number {
  const i = (usage.input_tokens ?? 0) * CLAUDE_PRICING_USD.input_per_million / 1_000_000;
  const o = (usage.output_tokens ?? 0) * CLAUDE_PRICING_USD.output_per_million / 1_000_000;
  const cr = (usage.cache_read_input_tokens ?? 0) * CLAUDE_PRICING_USD.cache_read_per_million / 1_000_000;
  const cw = (usage.cache_creation_input_tokens ?? 0) * CLAUDE_PRICING_USD.cache_write_per_million / 1_000_000;
  return i + o + cr + cw;
}

export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("createAnthropicClient: ANTHROPIC_API_KEY em falta no env.");
  }
  return new Anthropic({ apiKey });
}
