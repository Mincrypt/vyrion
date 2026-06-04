import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatRequest } from "../types/index.js";
import type { IProvider } from "../providers/base.js";
import { AnalyticsTracker } from "../analytics/tracker.js";
import { FallbackRouter } from "../router/fallback.js";

// ─────────────────────────────────────────────────────────────
//  Helpers: build mock providers
// ─────────────────────────────────────────────────────────────

function makeMockProvider(
  name: string,
  options: {
    available?: boolean;
    shouldFail?: boolean;
    latency?: number;
    content?: string;
  } = {}
): IProvider {
  const {
    available = true,
    shouldFail = false,
    content = `Response from ${name}`,
  } = options;

  const mockChat = vi.fn(async (_req: ChatRequest) => {
    if (shouldFail) throw new Error(`${name} provider error`);
    return {
      content,
      provider: name,
      model: "test-model",
      usage: { prompt: 10, completion: 20, total: 30 },
      latency: 100,
      cost: 0,
      finishReason: "stop",
    };
  });

  async function* mockStream(_req: ChatRequest) {
    if (shouldFail) throw new Error(`${name} stream error`);
    yield { delta: "Hello", done: false, provider: name, model: "test-model" };
    yield { delta: " World", done: true, provider: name, model: "test-model" };
  }

  return {
    name,
    defaultModel: "test-model",
    supportedModels: ["test-model"],
    isAvailable: () => available,
    chat: mockChat,
    stream: mockStream,
    healthCheck: async () => ({
      provider: name,
      status: "up" as const,
      latency: 50,
      checkedAt: new Date(),
    }),
  };
}

// ─────────────────────────────────────────────────────────────
//  Router Tests
// ─────────────────────────────────────────────────────────────

describe("FallbackRouter", () => {
  let analytics: AnalyticsTracker;
  let router: FallbackRouter;
  let providers: Map<string, IProvider>;

  beforeEach(() => {
    analytics = new AnalyticsTracker();
    providers = new Map([
      ["openai", makeMockProvider("openai")],
      ["groq", makeMockProvider("groq")],
      ["gemini", makeMockProvider("gemini")],
    ]);
    router = new FallbackRouter(providers, analytics);
  });

  it("routes to a specific provider when requested", async () => {
    const res = await router.chat({ message: "Hello", provider: "groq" });
    expect(res.provider).toBe("groq");
  });

  it("falls back to next provider when primary fails", async () => {
    providers.set("openai", makeMockProvider("openai", { shouldFail: true }));
    providers.set("groq", makeMockProvider("groq"));
    const res = await router.chat({ message: "Hello", provider: "openai" });
    expect(res.provider).toBe("groq");
  });

  it("throws when all providers fail", async () => {
    for (const [name] of providers) {
      providers.set(name, makeMockProvider(name, { shouldFail: true }));
    }
    await expect(router.chat({ message: "Hello" })).rejects.toThrow("All configured providers failed");
  });

  it("throws when no providers are available", async () => {
    for (const [name] of providers) {
      providers.set(name, makeMockProvider(name, { available: false }));
    }
    await expect(router.chat({ message: "Hello" })).rejects.toThrow("No active providers found");
  });

  it("throws for an unknown explicit provider", async () => {
    await expect(
      router.chat({ message: "Hello", provider: "unknown" })
    ).rejects.toThrow("is not configured");
  });

  it("records analytics events on success", async () => {
    await router.chat({ message: "Hello", provider: "groq" });
    const stats = analytics.getProviderStats("groq");
    expect(stats?.requests).toBe(1);
    expect(stats?.errors).toBe(0);
  });

  it("records error analytics on failure", async () => {
    providers.set("openai", makeMockProvider("openai", { shouldFail: true }));
    // groq will succeed as fallback
    await router.chat({ message: "Hello", provider: "openai" });
    const stats = analytics.getProviderStats("openai");
    expect(stats?.errors).toBe(1);
  });

  it("streams from the first available provider", async () => {
    const chunks: string[] = [];
    for await (const chunk of router.stream({ message: "Hello" })) {
      chunks.push(chunk.delta);
    }
    expect(chunks.join("")).toBe("Hello World");
  });

  it("falls back to next provider during stream failure", async () => {
    providers.set("openai", makeMockProvider("openai", { shouldFail: true }));
    const chunks: string[] = [];
    for await (const chunk of router.stream({ message: "Hello", provider: "openai" })) {
      chunks.push(chunk.delta);
    }
    expect(chunks.join("")).toBe("Hello World");
  });

  it("routes with goal=cheapest", async () => {
    // cheapest order: ollama > groq > ... So with only openai/groq/gemini, groq wins
    providers.set("ollama", makeMockProvider("ollama", { available: false }));
    const res = await router.chat({ message: "Hello", goal: "cheapest" });
    expect(res.provider).toBe("groq");
  });

  it("routes with goal=best to openai first", async () => {
    const res = await router.chat({ message: "Hello", goal: "best" });
    expect(res.provider).toBe("openai");
  });
});
