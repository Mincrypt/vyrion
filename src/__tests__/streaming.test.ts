import { describe, it, expect, vi } from "vitest";
import { AnalyticsTracker } from "../analytics/tracker.js";
import { FallbackRouter } from "../router/fallback.js";
import type { IProvider } from "../providers/base.js";
import type { ChatRequest, StreamChunk } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Streaming Tests
// ─────────────────────────────────────────────────────────────

function makeStreamingProvider(
  name: string,
  chunks: Array<Partial<StreamChunk>>,
  shouldFail = false
): IProvider {
  return {
    name,
    defaultModel: "test-model",
    supportedModels: ["test-model"],
    isAvailable: () => true,
    chat: vi.fn(),
    stream: async function* (_req: ChatRequest) {
      if (shouldFail) throw new Error(`${name} stream error`);
      for (const chunk of chunks) {
        yield {
          delta: chunk.delta ?? "",
          done: chunk.done ?? false,
          provider: name,
          model: "test-model",
        };
      }
    },
    healthCheck: async () => ({
      provider: name,
      status: "up" as const,
      checkedAt: new Date(),
    }),
  };
}

describe("Streaming", () => {
  it("yields all chunks from a provider", async () => {
    const provider = makeStreamingProvider("openai", [
      { delta: "Hello" },
      { delta: ", " },
      { delta: "World!", done: true },
    ]);

    const analytics = new AnalyticsTracker();
    const router = new FallbackRouter(new Map([["openai", provider]]), analytics);

    const collected: string[] = [];
    for await (const chunk of router.stream({ message: "Hi" })) {
      collected.push(chunk.delta);
    }

    expect(collected.join("")).toBe("Hello, World!");
  });

  it("falls back to another provider on stream error", async () => {
    const failing = makeStreamingProvider("openai", [], true);
    const working = makeStreamingProvider("groq", [
      { delta: "Fallback response", done: true },
    ]);

    const analytics = new AnalyticsTracker();
    const router = new FallbackRouter(
      new Map([
        ["openai", failing],
        ["groq", working],
      ]),
      analytics
    );

    const collected: string[] = [];
    for await (const chunk of router.stream({ message: "Hi", provider: "openai" })) {
      collected.push(chunk.delta);
    }

    expect(collected.join("")).toBe("Fallback response");
    expect(analytics.getProviderStats("openai")?.errors).toBe(1);
    expect(analytics.getProviderStats("groq")?.requests).toBe(1);
  });

  it("sets provider and model on each chunk", async () => {
    const provider = makeStreamingProvider("gemini", [
      { delta: "A" },
      { delta: "B", done: true },
    ]);

    const analytics = new AnalyticsTracker();
    const router = new FallbackRouter(new Map([["gemini", provider]]), analytics);

    for await (const chunk of router.stream({ message: "Test" })) {
      expect(chunk.provider).toBe("gemini");
      expect(chunk.model).toBe("test-model");
    }
  });

  it("throws when all providers fail during streaming", async () => {
    const p1 = makeStreamingProvider("openai", [], true);
    const p2 = makeStreamingProvider("groq", [], true);

    const analytics = new AnalyticsTracker();
    const router = new FallbackRouter(
      new Map([["openai", p1], ["groq", p2]]),
      analytics
    );

    const gen = router.stream({ message: "Hi" });
    await expect(gen.next()).rejects.toThrow("All configured providers failed during streaming");
  });
});
