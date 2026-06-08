import { describe, it, expect } from "vitest";
import Vyrion from "../index.js";

describe("Circuit Breaker & Cooldown Routing", () => {
  it("should bypass a provider after consecutive failures threshold is reached", async () => {
    let badCallCount = 0;
    let goodCallCount = 0;

    const ai = new Vyrion({
      openai: "sk-test",
      circuitBreaker: {
        failuresThreshold: 2,
        cooldownMs: 5000,
      },
    });

    // Register a bad provider that always fails
    ai.registerProvider({
      name: "bad-provider",
      defaultModel: "model-bad",
      isAvailable: () => true,
      chat: async () => {
        badCallCount++;
        throw new Error("Temporary provider failure");
      },
      stream: async function* () {},
      healthCheck: async () => ({ provider: "bad-provider", status: "up", checkedAt: new Date() }),
    });

    // Register a good provider that always succeeds
    ai.registerProvider({
      name: "good-provider",
      defaultModel: "model-good",
      isAvailable: () => true,
      chat: async () => {
        goodCallCount++;
        return {
          content: "Hello",
          provider: "good-provider",
          model: "model-good",
          usage: { prompt: 1, completion: 1, total: 2 },
          latency: 5,
          cost: 0,
          finishReason: "stop",
        };
      },
      stream: async function* () {},
      healthCheck: async () => ({ provider: "good-provider", status: "up", checkedAt: new Date() }),
    });

    // Call chat routing: we will specify fallback: ["bad-provider", "good-provider"]
    // First call: tries bad-provider (fails), then tries good-provider (succeeds)
    let res = await ai.chat({
      message: "hi",
      provider: "bad-provider",
      fallback: ["bad-provider", "good-provider"],
    });
    expect(res.content).toBe("Hello");
    expect(badCallCount).toBe(1);
    expect(goodCallCount).toBe(1);

    // Second call: tries bad-provider (fails) -> trips the circuit breaker! then tries good-provider (succeeds)
    res = await ai.chat({
      message: "hi",
      provider: "bad-provider",
      fallback: ["bad-provider", "good-provider"],
    });
    expect(res.content).toBe("Hello");
    expect(badCallCount).toBe(2);
    expect(goodCallCount).toBe(2);

    // Third call: since bad-provider is on cooldown, the router should skip it entirely and route directly to good-provider!
    res = await ai.chat({
      message: "hi",
      provider: "bad-provider",
      fallback: ["bad-provider", "good-provider"],
    });
    expect(res.content).toBe("Hello");
    expect(badCallCount).toBe(2); // Should not have increased!
    expect(goodCallCount).toBe(3); // good-provider handles the request directly
  });

  it("should instantly trip circuit breaker on HTTP 429 Rate Limit Exceeded", async () => {
    let rateLimitedCalls = 0;
    let fallbackCalls = 0;

    const ai = new Vyrion({
      openai: "sk-test",
      circuitBreaker: {
        failuresThreshold: 3, // High threshold
        cooldownMs: 5000,
      },
    });

    ai.registerProvider({
      name: "rate-limited-provider",
      defaultModel: "model-rl",
      isAvailable: () => true,
      chat: async () => {
        rateLimitedCalls++;
        // Throw a mock rate limit error
        const err: any = new Error("Rate Limit Exceeded");
        err.status = 429;
        throw err;
      },
      stream: async function* () {},
      healthCheck: async () => ({ provider: "rate-limited-provider", status: "up", checkedAt: new Date() }),
    });

    ai.registerProvider({
      name: "fallback-provider",
      defaultModel: "model-fb",
      isAvailable: () => true,
      chat: async () => {
        fallbackCalls++;
        return {
          content: "Recovered",
          provider: "fallback-provider",
          model: "model-fb",
          usage: { prompt: 1, completion: 1, total: 2 },
          latency: 5,
          cost: 0,
          finishReason: "stop",
        };
      },
      stream: async function* () {},
      healthCheck: async () => ({ provider: "fallback-provider", status: "up", checkedAt: new Date() }),
    });

    // First call: rate-limited-provider throws 429, should instantly trip and fall back
    let res = await ai.chat({
      message: "hi",
      provider: "rate-limited-provider",
      fallback: ["rate-limited-provider", "fallback-provider"],
    });
    expect(res.content).toBe("Recovered");
    expect(rateLimitedCalls).toBe(1);
    expect(fallbackCalls).toBe(1);

    // Second call: should immediately bypass rate-limited-provider without calling it
    res = await ai.chat({
      message: "hi",
      provider: "rate-limited-provider",
      fallback: ["rate-limited-provider", "fallback-provider"],
    });
    expect(res.content).toBe("Recovered");
    expect(rateLimitedCalls).toBe(1); // Still 1!
    expect(fallbackCalls).toBe(2);
  });
});
