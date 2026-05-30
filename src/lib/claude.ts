import Anthropic from "@anthropic-ai/sdk";

// Modelo em uso. Para trocar para Haiku (mais barato/rapido), basta mudar
// esta constante para "claude-haiku-4-5-20251001". Sonnet 4.6 e melhor para
// portugues europeu e tom de marca; Haiku e suficiente para respostas
// curtas.
export const CLAUDE_MODEL = "claude-sonnet-4-6";

export function createAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("createAnthropicClient: ANTHROPIC_API_KEY em falta no env.");
  }
  return new Anthropic({ apiKey });
}
