import { AnthropicCompatibleToolUseAdapter } from "./anthropic-compatible.js";

export class MiniMaxToolUseAdapter extends AnthropicCompatibleToolUseAdapter {
  constructor({
    apiKey = process.env.MINIMAX_API_KEY,
    baseUrl = process.env.MINIMAX_BASE_URL || "https://api.minimaxi.com/anthropic",
    model = process.env.MINIMAX_MODEL || "MiniMax-M2.7-highspeed",
    temperature = 0.3,
    maxTokens = 1200,
    safetyMaxIterations = 128
  } = {}) {
    super({
      provider: "minimax",
      apiKey,
      baseUrl,
      model,
      temperature,
      maxTokens,
      safetyMaxIterations
    });
  }
}

export function createMiniMaxToolUseAdapter(config = {}) {
  return new MiniMaxToolUseAdapter(config);
}
