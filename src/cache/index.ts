import type { ICache, ChatResponse, ChatRequest, Middleware } from "../types/index.js";

/**
 * In-memory cache implementation.
 */
export class InMemoryCache implements ICache {
  private store = new Map<string, { value: ChatResponse; expiresAt?: number }>();

  get(key: string): ChatResponse | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: ChatResponse, ttl?: number): void {
    const expiresAt = ttl !== undefined ? Date.now() + ttl * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Deterministically generates a cache key from a ChatRequest.
 */
export function generateCacheKey(req: ChatRequest): string {
  const keyParts = {
    message: req.message,
    messages: req.messages?.map((m) => `${m.role}:${m.content}`).join("|"),
    systemPrompt: req.systemPrompt,
    provider: req.provider,
    model: req.model,
    temperature: req.temperature,
    maxTokens: req.maxTokens,
    goal: typeof req.goal === "string" ? req.goal : undefined,
  };

  return JSON.stringify(keyParts);
}

/**
 * Middleware that handles caching for non-streaming requests.
 */
export function createCacheMiddleware(cache: ICache, defaultTtl?: number): Middleware {
  return async (ctx, next) => {
    // Only cache non-streaming requests
    if (ctx.request.stream || ctx.request.cache === false) {
      return next();
    }

    const key = generateCacheKey(ctx.request);

    try {
      const cached = await cache.get(key);
      if (cached) {
        // Return a copy with deep copy/fresh state if needed, or simply return it
        return {
          ...cached,
          // We can mark it as a cache hit, but keeping standard fields is clean
        };
      }
    } catch (err) {
      console.warn("Vyrion cache read error:", err);
    }

    const response = await next();

    try {
      await cache.set(key, response, defaultTtl);
    } catch (err) {
      console.warn("Vyrion cache write error:", err);
    }

    return response;
  };
}
