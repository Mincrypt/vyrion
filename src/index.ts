/**
 * Vyrion by Mincr Technology
 * One intelligent runtime for every LLM.
 * https://mincr.in/vyrion
 */

import { OpenAIProvider } from "./providers/openai.js";
import { GroqProvider } from "./providers/groq.js";
import { GeminiProvider } from "./providers/gemini.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { MistralProvider } from "./providers/mistral.js";
import { TogetherProvider } from "./providers/together.js";
import { OllamaProvider } from "./providers/ollama.js";
import type { IProvider } from "./providers/base.js";

import { FallbackRouter } from "./router/fallback.js";

import { AnalyticsTracker } from "./analytics/tracker.js";
import { HealthMonitor } from "./analytics/health.js";
import { estimateCost, getPricing, setPricing } from "./analytics/cost.js";

import { PluginRegistry } from "./plugins/registry.js";
import type { ProviderPlugin } from "./plugins/registry.js";

import type {
  VyrionConfig,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  AnalyticsSnapshot,
  HealthCheckResult,
  ProviderConfig,
  ModelPricing,
} from "./types/index.js";

// ─────────────────────────────────────────────────────────────
//  Re-export all public types for consumers
// ─────────────────────────────────────────────────────────────
export type {
  VyrionConfig,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  AnalyticsSnapshot,
  HealthCheckResult,
  ProviderConfig,
  ModelPricing,
  Message,
  TokenUsage,
  RoutingGoal,
  ProviderStats,
  HealthStatus,
} from "./types/index.js";
export type { ProviderPlugin } from "./plugins/registry.js";

// ─────────────────────────────────────────────────────────────
//  Helper: normalise a config value to ProviderConfig
// ─────────────────────────────────────────────────────────────

function toProviderConfig(
  value: string | ProviderConfig,
  globalTimeout?: number
): ProviderConfig {
  if (typeof value === "string") {
    return { apiKey: value, timeout: globalTimeout };
  }
  return { timeout: globalTimeout, ...value };
}

// ─────────────────────────────────────────────────────────────
//  Vyrion — Main Class  |  Powered by Mincr Technology
// ─────────────────────────────────────────────────────────────

export class Vyrion {
  private readonly providers: Map<string, IProvider>;
  private readonly router: FallbackRouter;
  private readonly analytics: AnalyticsTracker;
  private readonly health: HealthMonitor;
  private readonly plugins: PluginRegistry;
  private readonly config: VyrionConfig;

  constructor(config: VyrionConfig = {}) {
    this.config = config;
    this.analytics = new AnalyticsTracker();
    this.health = new HealthMonitor();
    this.plugins = new PluginRegistry();

    const timeout = config.timeout;

    // ── Only register providers that were explicitly configured ──────────────
    // Each entry is added to the list only when the user supplied a config value
    // for that provider key. This prevents unconfigured providers from appearing
    // in routing, health checks, or error messages.
    const configured: Array<[string, IProvider]> = [];

    if (config.openai) {
      configured.push(["openai", new OpenAIProvider(toProviderConfig(config.openai as string | ProviderConfig, timeout))]);
    }
    if (config.groq) {
      configured.push(["groq", new GroqProvider(toProviderConfig(config.groq as string | ProviderConfig, timeout))]);
    }
    if (config.gemini) {
      configured.push(["gemini", new GeminiProvider(toProviderConfig(config.gemini as string | ProviderConfig, timeout))]);
    }
    if (config.anthropic) {
      configured.push(["anthropic", new AnthropicProvider(toProviderConfig(config.anthropic as string | ProviderConfig, timeout))]);
    }
    if (config.mistral) {
      configured.push(["mistral", new MistralProvider(toProviderConfig(config.mistral as string | ProviderConfig, timeout))]);
    }
    if (config.together) {
      configured.push(["together", new TogetherProvider(toProviderConfig(config.together as string | ProviderConfig, timeout))]);
    }
    // Ollama needs no API key — include it whenever the user mentions it in config
    if (config.ollama !== undefined) {
      configured.push(["ollama", new OllamaProvider(toProviderConfig(config.ollama as string | ProviderConfig, timeout))]);
    }

    // ── Validate that at least one provider was configured ───────────────────
    if (configured.length === 0) {
      throw new Error(
        "No active providers found. Please configure at least one provider API key.\n\n" +
        "Examples:\n" +
        "  const ai = new Vyrion({ openai: process.env.OPENAI_API_KEY });\n" +
        "  const ai = new Vyrion({ groq: process.env.GROQ_API_KEY });\n" +
        "  const ai = new Vyrion({ gemini: process.env.GEMINI_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY });\n" +
        "  const ai = new Vyrion({ ollama: { baseUrl: 'http://localhost:11434' } });"
      );
    }

    this.providers = new Map(configured);
    this.router = new FallbackRouter(this.providers, this.analytics);
  }


  // ── Core API ─────────────────────────────────────────────

  /**
   * Send a chat request and receive a full response.
   *
   * @example
   * const res = await ai.chat({ message: "Hello", provider: "auto" });
   * console.log(res.content);
   */
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const mergedReq = this.applyDefaults(req);
    const response = await this.router.chat(mergedReq);
    // Backfill cost if not already set by the provider
    if (response.cost === 0) {
      response.cost = estimateCost(response.provider, response.model, response.usage);
    }
    return response;
  }

  /**
   * Stream a chat response as an async generator of chunks.
   *
   * @example
   * for await (const chunk of ai.stream({ message: "Tell me a story" })) {
   *   process.stdout.write(chunk.delta);
   * }
   */
  stream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    return this.router.stream(this.applyDefaults(req));
  }

  // ── Provider Management ───────────────────────────────────

  /**
   * Register a custom provider plugin.
   *
   * @example
   * ai.registerProvider({
   *   name: "my-api",
   *   defaultModel: "my-model",
   *   isAvailable: () => true,
   *   chat: async (req) => { ... },
   *   stream: async function* (req) { yield ...; },
   *   healthCheck: async () => ({ provider: "my-api", status: "up", checkedAt: new Date() }),
   * });
   */
  registerProvider(plugin: ProviderPlugin): void {
    this.plugins.register(plugin);
    // Merge into the provider map so the router picks it up immediately
    for (const [name, provider] of this.plugins.getAll()) {
      this.providers.set(name, provider);
    }
  }

  /**
   * Remove a previously registered custom provider.
   */
  unregisterProvider(name: string): boolean {
    const removed = this.plugins.unregister(name);
    if (removed) this.providers.delete(name);
    return removed;
  }

  /**
   * List all configured provider names (including custom plugins).
   */
  getProviders(): string[] {
    return [...this.providers.keys()];
  }

  /**
   * List available (configured) provider names.
   */
  getAvailableProviders(): string[] {
    return [...this.providers.values()]
      .filter((p) => p.isAvailable())
      .map((p) => p.name);
  }

  // ── Analytics ─────────────────────────────────────────────

  /**
   * Get a full analytics snapshot for all providers.
   */
  getStats(): AnalyticsSnapshot {
    return this.analytics.getSnapshot();
  }

  /**
   * Reset analytics counters.
   */
  resetStats(): void {
    this.analytics.reset();
  }

  // ── Health ────────────────────────────────────────────────

  /**
   * Trigger an immediate health check on all available providers.
   */
  async getProviderHealth(): Promise<HealthCheckResult[]> {
    const available = [...this.providers.values()].filter((p) => p.isAvailable());
    return Promise.all(available.map((p) => p.healthCheck()));
  }

  /**
   * Start background health monitoring (checks every intervalMs, default 5 min).
   */
  startHealthMonitor(intervalMs?: number): void {
    const monitor = intervalMs
      ? new HealthMonitor(intervalMs)
      : this.health;
    monitor.start([...this.providers.values()]);
  }

  /**
   * Stop background health monitoring.
   */
  stopHealthMonitor(): void {
    this.health.stop();
  }

  // ── Cost ─────────────────────────────────────────────────

  /**
   * Get cumulative cost estimate from analytics (in USD).
   */
  getTotalCost(): number {
    return this.analytics.getSnapshot().totalCost;
  }

  /**
   * Update pricing data for a provider/model.
   * Useful when provider prices change.
   */
  setPricing(provider: string, model: string, pricing: ModelPricing): void {
    setPricing(provider, model, pricing);
  }

  /**
   * Get current pricing table.
   */
  getPricing(provider?: string) {
    return getPricing(provider);
  }

  // ── Private ──────────────────────────────────────────────

  private applyDefaults(req: ChatRequest): ChatRequest {
    return {
      goal: this.config.defaultGoal ?? "auto",
      fallback: this.config.fallback,
      ...req,
    };
  }
}

// ─────────────────────────────────────────────────────────────
//  Named exports for convenience
// ─────────────────────────────────────────────────────────────
export { estimateCost, getPricing, setPricing };
export { AnalyticsTracker } from "./analytics/tracker.js";
export { HealthMonitor } from "./analytics/health.js";
export { PluginRegistry } from "./plugins/registry.js";

/** Default export: Vyrion class */
export default Vyrion;

/** @deprecated Use `Vyrion` instead — kept for migration convenience */
export { Vyrion as OmniLLM };
