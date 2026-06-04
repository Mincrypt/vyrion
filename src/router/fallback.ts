import type { IProvider } from "../providers/base.js";
import type { ChatRequest, ChatResponse, StreamChunk } from "../types/index.js";
import type { AnalyticsTracker } from "../analytics/tracker.js";
import { resolveStrategy } from "./strategies.js";

// ─────────────────────────────────────────────────────────────
//  Fallback Router
//  Selects a provider via strategy, then walks a fallback chain
//  on failure before throwing a final error.
// ─────────────────────────────────────────────────────────────

/** Default fallback chain in priority order */
const DEFAULT_FALLBACK: readonly string[] = [
  "openai",
  "groq",
  "gemini",
  "anthropic",
  "mistral",
  "together",
  "ollama",
];

export class FallbackRouter {
  constructor(
    private readonly providers: Map<string, IProvider>,
    private readonly analytics: AnalyticsTracker
  ) {}

  // ── Public API ───────────────────────────────────────────

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const chain = this.buildChain(req);

    let lastError: unknown;
    for (const provider of chain) {
      try {
        const start = Date.now();
        const response = await provider.chat(req);
        this.analytics.record({
          provider: provider.name,
          latency: Date.now() - start,
          tokens: response.usage.total,
          cost: response.cost,
          success: true,
        });
        return response;
      } catch (err) {
        lastError = err;
        this.analytics.record({
          provider: provider.name,
          latency: 0,
          tokens: 0,
          cost: 0,
          success: false,
        });
        // Try the next provider in the chain
      }
    }

    throw new Error(
      `All configured providers failed. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }\n\nProviders tried: ${chain.map((p) => p.name).join(" → ")}`
    );
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    const chain = this.buildChain(req);

    let lastError: unknown;
    for (const provider of chain) {
      try {
        const start = Date.now();
        let tokens = 0;
        for await (const chunk of provider.stream(req)) {
          tokens += chunk.delta.length; // Rough token estimate for streaming
          yield chunk;
        }
        this.analytics.record({
          provider: provider.name,
          latency: Date.now() - start,
          tokens,
          cost: 0,
          success: true,
        });
        return;
      } catch (err) {
        lastError = err;
        this.analytics.record({
          provider: provider.name,
          latency: 0,
          tokens: 0,
          cost: 0,
          success: false,
        });
      }
    }

    throw new Error(
      `All configured providers failed during streaming. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }\n\nProviders tried: ${chain.map((p) => p.name).join(" → ")}`
    );
  }

  // ── Private ──────────────────────────────────────────────

  /**
   * Build the ordered list of providers to try.
   * 1. If req.provider is a specific name → try that first, then fallback.
   * 2. If req.provider is "auto" or unset → use strategy to pick first, then fallback.
   * 3. If req.fallback is specified → use that chain instead of default.
   */
  private buildChain(req: ChatRequest): IProvider[] {
    const available = this.getAvailable();

    if (available.length === 0) {
      throw new Error(
        "No active providers found. Please configure at least one provider API key.\n" +
        "See: https://mincr.in/vyrion#quick-start"
      );
    }

    // Explicit single provider requested
    if (req.provider && req.provider !== "auto") {
      const primary = this.providers.get(req.provider);
      if (!primary) {
        throw new Error(
          `Provider "${req.provider}" is not configured. ` +
          `Add it to your Vyrion config: new Vyrion({ ${req.provider}: process.env.${req.provider.toUpperCase()}_API_KEY })`
        );
      }
      if (!primary.isAvailable()) throw new Error(`Provider "${req.provider}" is not configured.`);

      // Build fallback excluding the primary
      const fallbackNames = req.fallback ?? [...DEFAULT_FALLBACK];
      const rest = fallbackNames
        .filter((n) => n !== req.provider)
        .map((n) => this.providers.get(n))
        .filter((p): p is IProvider => p !== undefined && p.isAvailable());

      return [primary, ...rest];
    }

    // Auto-routing: pick via strategy first, then arrange remaining as fallback
    const goal = req.goal ?? "auto";
    const strategy = resolveStrategy(goal);
    const primary = strategy(available, this.analytics);

    const fallbackNames = req.fallback ?? [...DEFAULT_FALLBACK];
    const rest = fallbackNames
      .filter((n) => n !== primary.name)
      .map((n) => this.providers.get(n))
      .filter((p): p is IProvider => p !== undefined && p.isAvailable());

    // Remaining available providers not already in chain
    const inChain = new Set([primary.name, ...rest.map((p) => p.name)]);
    const extra = available.filter((p) => !inChain.has(p.name));

    return [primary, ...rest, ...extra];
  }

  private getAvailable(): IProvider[] {
    return [...this.providers.values()].filter((p) => p.isAvailable());
  }
}
