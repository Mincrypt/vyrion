import type { IProvider } from "../providers/base.js";
import type { RoutingGoal } from "../types/index.js";
import type { AnalyticsTracker } from "../analytics/tracker.js";

// ─────────────────────────────────────────────────────────────
//  Routing Strategies
//  Each strategy receives available (healthy) providers +
//  analytics and returns the single provider to use.
// ─────────────────────────────────────────────────────────────

export type Strategy = (
  providers: IProvider[],
  analytics: AnalyticsTracker
) => IProvider;

/** Priority order for "best" strategy */
const BEST_PRIORITY: readonly string[] = [
  "openai",
  "anthropic",
  "gemini",
  "mistral",
  "groq",
  "together",
  "ollama",
];

/** Default fallback chain order for "auto" */
const AUTO_PRIORITY: readonly string[] = [
  "openai",
  "groq",
  "gemini",
  "anthropic",
  "mistral",
  "together",
  "ollama",
];

/**
 * Round-robin across available providers, guided by the default priority order.
 */
export const autoStrategy: Strategy = (providers) => {
  for (const name of AUTO_PRIORITY) {
    const p = providers.find((pr) => pr.name === name);
    if (p) return p;
  }
  return providers[0]!;
};

/**
 * Pick the provider with the lowest recent average latency.
 * Falls back to auto if no latency data exists yet.
 */
export const fastestStrategy: Strategy = (providers, analytics) => {
  let best: IProvider | undefined;
  let bestLatency = Infinity;

  for (const provider of providers) {
    const stats = analytics.getProviderStats(provider.name);
    if (stats && stats.avgLatency > 0 && stats.avgLatency < bestLatency) {
      bestLatency = stats.avgLatency;
      best = provider;
    }
  }

  return best ?? autoStrategy(providers, analytics);
};

/**
 * Pick the provider with the lowest estimated cost per token.
 * Groq (free tier) and Ollama (local) are prioritised.
 */
export const cheapestStrategy: Strategy = (providers) => {
  const cheapOrder: readonly string[] = [
    "ollama",
    "groq",
    "together",
    "gemini",
    "mistral",
    "anthropic",
    "openai",
  ];
  for (const name of cheapOrder) {
    const p = providers.find((pr) => pr.name === name);
    if (p) return p;
  }
  return providers[0]!;
};

/**
 * Pick the highest-capability provider available.
 */
export const bestStrategy: Strategy = (providers) => {
  for (const name of BEST_PRIORITY) {
    const p = providers.find((pr) => pr.name === name);
    if (p) return p;
  }
  return providers[0]!;
};

/**
 * Resolve a goal string to the matching strategy function.
 */
export function resolveStrategy(goal: RoutingGoal): Strategy {
  switch (goal) {
    case "fastest": return fastestStrategy;
    case "cheapest": return cheapestStrategy;
    case "best": return bestStrategy;
    default: return autoStrategy;
  }
}
