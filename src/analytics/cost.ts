import type { ModelPricing, TokenUsage } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Cost Estimation
//  Pricing data sourced from provider pricing pages.
//  Prices are in USD per 1 million tokens.
//  Last updated: June 2025
// ─────────────────────────────────────────────────────────────

type PricingTable = Record<string, Record<string, ModelPricing>>;

const PRICING: PricingTable = {
  openai: {
    "gpt-4o": { inputPer1M: 2.50, outputPer1M: 10.00 },
    "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.60 },
    "gpt-4-turbo": { inputPer1M: 10.00, outputPer1M: 30.00 },
    "gpt-4": { inputPer1M: 30.00, outputPer1M: 60.00 },
    "gpt-3.5-turbo": { inputPer1M: 0.50, outputPer1M: 1.50 },
    "o1": { inputPer1M: 15.00, outputPer1M: 60.00 },
    "o1-mini": { inputPer1M: 3.00, outputPer1M: 12.00 },
    "o3-mini": { inputPer1M: 1.10, outputPer1M: 4.40 },
  },
  groq: {
    "llama-3.3-70b-versatile": { inputPer1M: 0.59, outputPer1M: 0.79 },
    "llama-3.1-70b-versatile": { inputPer1M: 0.59, outputPer1M: 0.79 },
    "llama-3.1-8b-instant": { inputPer1M: 0.05, outputPer1M: 0.08 },
    "llama3-70b-8192": { inputPer1M: 0.59, outputPer1M: 0.79 },
    "llama3-8b-8192": { inputPer1M: 0.05, outputPer1M: 0.08 },
    "mixtral-8x7b-32768": { inputPer1M: 0.24, outputPer1M: 0.24 },
    "gemma2-9b-it": { inputPer1M: 0.20, outputPer1M: 0.20 },
  },
  gemini: {
    "gemini-2.5-pro-preview-06-05": { inputPer1M: 1.25, outputPer1M: 10.00 },
    "gemini-2.5-flash-preview-05-20": { inputPer1M: 0.15, outputPer1M: 0.60 },
    "gemini-2.0-flash": { inputPer1M: 0.10, outputPer1M: 0.40 },
    "gemini-2.0-flash-lite": { inputPer1M: 0.075, outputPer1M: 0.30 },
    "gemini-1.5-pro": { inputPer1M: 1.25, outputPer1M: 5.00 },
    "gemini-1.5-flash": { inputPer1M: 0.075, outputPer1M: 0.30 },
    "gemini-1.5-flash-8b": { inputPer1M: 0.0375, outputPer1M: 0.15 },
  },
  anthropic: {
    "claude-opus-4-5": { inputPer1M: 15.00, outputPer1M: 75.00 },
    "claude-sonnet-4-5": { inputPer1M: 3.00, outputPer1M: 15.00 },
    "claude-haiku-4-5": { inputPer1M: 0.80, outputPer1M: 4.00 },
    "claude-3-7-sonnet-latest": { inputPer1M: 3.00, outputPer1M: 15.00 },
    "claude-3-5-sonnet-latest": { inputPer1M: 3.00, outputPer1M: 15.00 },
    "claude-3-5-haiku-latest": { inputPer1M: 0.80, outputPer1M: 4.00 },
    "claude-3-opus-latest": { inputPer1M: 15.00, outputPer1M: 75.00 },
    "claude-3-haiku-20240307": { inputPer1M: 0.25, outputPer1M: 1.25 },
  },
  mistral: {
    "mistral-large-latest": { inputPer1M: 2.00, outputPer1M: 6.00 },
    "mistral-medium-latest": { inputPer1M: 0.40, outputPer1M: 2.00 },
    "mistral-small-latest": { inputPer1M: 0.10, outputPer1M: 0.30 },
    "codestral-latest": { inputPer1M: 0.20, outputPer1M: 0.60 },
    "open-mistral-nemo": { inputPer1M: 0.15, outputPer1M: 0.15 },
    "open-mixtral-8x22b": { inputPer1M: 2.00, outputPer1M: 6.00 },
    "open-mixtral-8x7b": { inputPer1M: 0.70, outputPer1M: 0.70 },
  },
  together: {
    "meta-llama/Llama-3-70b-chat-hf": { inputPer1M: 0.90, outputPer1M: 0.90 },
    "meta-llama/Llama-3-8b-chat-hf": { inputPer1M: 0.20, outputPer1M: 0.20 },
    "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo": { inputPer1M: 3.50, outputPer1M: 3.50 },
    "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo": { inputPer1M: 0.88, outputPer1M: 0.88 },
    "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": { inputPer1M: 0.18, outputPer1M: 0.18 },
    "mistralai/Mixtral-8x7B-Instruct-v0.1": { inputPer1M: 0.60, outputPer1M: 0.60 },
    "Qwen/Qwen2-72B-Instruct": { inputPer1M: 0.90, outputPer1M: 0.90 },
  },
  ollama: {
    // Local models — always free
    default: { inputPer1M: 0, outputPer1M: 0 },
  },
};

// ─────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────

/**
 * Estimate the cost of a request in USD.
 */
export function estimateCost(provider: string, model: string, usage: TokenUsage): number {
  const providerPricing = PRICING[provider];
  if (!providerPricing) return 0;

  const modelPricing = providerPricing[model] ?? providerPricing["default"];
  if (!modelPricing) return 0;

  const inputCost = (usage.prompt / 1_000_000) * modelPricing.inputPer1M;
  const outputCost = (usage.completion / 1_000_000) * modelPricing.outputPer1M;

  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000; // 6 decimal places
}

/**
 * Get the pricing table for a specific provider (or all providers).
 */
export function getPricing(provider?: string): PricingTable | Record<string, ModelPricing> | undefined {
  if (provider) return PRICING[provider];
  return PRICING;
}

/**
 * Override or add pricing for a model (for custom providers or updated prices).
 */
export function setPricing(provider: string, model: string, pricing: ModelPricing): void {
  if (!PRICING[provider]) PRICING[provider] = {};
  PRICING[provider]![model] = pricing;
}
