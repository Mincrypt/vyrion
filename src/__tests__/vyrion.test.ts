import { describe, it, expect, vi, beforeEach } from "vitest";
import Vyrion from "../index.js";
import type { ChatRequest } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Vyrion Integration + Plugin Tests  |  Powered by Mincr Technology
// ─────────────────────────────────────────────────────────────

// Mock the OpenAI module so no real network calls happen
// @ts-ignore
vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "Mocked OpenAI response" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
            model: "gpt-4o-mini",
          }),
        },
      },
      models: { list: vi.fn().mockResolvedValue({ data: [] }) },
    })),
  };
});

// ─────────────────────────────────────────────────────────────
//  Partial Provider Configuration Tests
// ─────────────────────────────────────────────────────────────

describe("Vyrion — partial provider configuration", () => {
  it("works with only openai configured", () => {
    const ai = new Vyrion({ openai: "sk-test-key" });
    expect(ai.getProviders()).toEqual(["openai"]);
    expect(ai.getAvailableProviders()).toEqual(["openai"]);
  });

  it("works with only groq configured", () => {
    // groq-sdk is not installed so the provider list will still contain 'groq'
    // because we only check config presence, not SDK presence
    const ai = new Vyrion({ groq: "gsk_test_key" });
    expect(ai.getProviders()).toEqual(["groq"]);
    expect(ai.getAvailableProviders()).toEqual(["groq"]);
  });

  it("works with only gemini configured", () => {
    const ai = new Vyrion({ gemini: "AIza_test_key" });
    expect(ai.getProviders()).toEqual(["gemini"]);
    expect(ai.getAvailableProviders()).toEqual(["gemini"]);
  });

  it("works with only anthropic configured", () => {
    const ai = new Vyrion({ anthropic: "sk-ant-test" });
    expect(ai.getProviders()).toEqual(["anthropic"]);
    expect(ai.getAvailableProviders()).toEqual(["anthropic"]);
  });

  it("works with only mistral configured", () => {
    const ai = new Vyrion({ mistral: "mistral_test_key" });
    expect(ai.getProviders()).toEqual(["mistral"]);
    expect(ai.getAvailableProviders()).toEqual(["mistral"]);
  });

  it("works with two providers configured", () => {
    const ai = new Vyrion({ openai: "sk-test", gemini: "AIza_test" });
    expect(ai.getProviders()).toEqual(["openai", "gemini"]);
    expect(ai.getAvailableProviders()).toEqual(["openai", "gemini"]);
  });

  it("does NOT include unconfigured providers in the provider list", () => {
    const ai = new Vyrion({ groq: "gsk_test" });
    const providers = ai.getProviders();
    expect(providers).not.toContain("openai");
    expect(providers).not.toContain("gemini");
    expect(providers).not.toContain("anthropic");
    expect(providers).not.toContain("mistral");
    expect(providers).not.toContain("together");
    expect(providers).not.toContain("ollama");
  });

  it("includes ollama when explicitly set (no API key needed)", () => {
    const ai = new Vyrion({ ollama: { baseUrl: "http://localhost:11434" } });
    expect(ai.getProviders()).toContain("ollama");
    expect(ai.getAvailableProviders()).toContain("ollama");
  });

  it("does NOT include ollama when not configured", () => {
    const ai = new Vyrion({ openai: "sk-test" });
    expect(ai.getProviders()).not.toContain("ollama");
  });
});

// ─────────────────────────────────────────────────────────────
//  Zero-Provider Validation Tests
// ─────────────────────────────────────────────────────────────

describe("Vyrion — zero-provider validation", () => {
  it("throws when constructed with no config", () => {
    expect(() => new Vyrion()).toThrow("No active providers found");
  });

  it("throws when constructed with empty config object", () => {
    // Cast to bypass TypeScript: simulate a user who passes no valid keys
    expect(() => new Vyrion({} as never)).toThrow("No active providers found");
  });

  it("throws with a helpful message listing examples", () => {
    let message = "";
    try {
      new Vyrion({} as never);
    } catch (err) {
      message = err instanceof Error ? err.message : "";
    }
    expect(message).toContain("No active providers found");
    expect(message).toContain("Please configure at least one provider API key");
    expect(message).toContain("Vyrion({");
  });

  it("does NOT throw when at least one provider is configured", () => {
    expect(() => new Vyrion({ openai: "sk-test" })).not.toThrow();
    expect(() => new Vyrion({ groq: "gsk_test" })).not.toThrow();
    expect(() => new Vyrion({ ollama: {} })).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
//  Core API Tests
// ─────────────────────────────────────────────────────────────

describe("Vyrion — core API", () => {
  let ai: Vyrion;

  beforeEach(() => {
    ai = new Vyrion({ openai: "sk-test-key" });
  });

  it("chat returns a normalised response", async () => {
    const res = await ai.chat({ message: "Hello", provider: "openai" });
    expect(res.content).toBe("Mocked OpenAI response");
    expect(res.provider).toBe("openai");
    expect(res.usage.total).toBe(30);
  });

  it("getStats returns a snapshot after requests", async () => {
    await ai.chat({ message: "Hello", provider: "openai" });
    const stats = ai.getStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.providers.length).toBeGreaterThan(0);
  });

  it("resetStats clears counters", async () => {
    await ai.chat({ message: "Hello", provider: "openai" });
    ai.resetStats();
    expect(ai.getStats().totalRequests).toBe(0);
  });

  it("getTotalCost is a number", async () => {
    await ai.chat({ message: "Hello", provider: "openai" });
    expect(typeof ai.getTotalCost()).toBe("number");
  });

  it("throws a helpful error when requesting an unconfigured provider", async () => {
    // Only openai is configured; requesting groq should throw
    await expect(
      ai.chat({ message: "Hello", provider: "groq" })
    ).rejects.toThrow("not configured");
  });
});

// ─────────────────────────────────────────────────────────────
//  Plugin Registry Tests
// ─────────────────────────────────────────────────────────────

describe("Vyrion — registerProvider", () => {
  // Use openai as the base provider since empty config now throws
  const makeAI = () => new Vyrion({ openai: "sk-test" });

  it("registers and uses a custom provider", async () => {
    const ai = makeAI();
    ai.registerProvider({
      name: "my-custom",
      defaultModel: "custom-v1",
      isAvailable: () => true,
      chat: async (_req: ChatRequest) => ({
        content: "Custom response",
        provider: "my-custom",
        model: "custom-v1",
        usage: { prompt: 5, completion: 10, total: 15 },
        latency: 50,
        cost: 0,
        finishReason: "stop",
      }),
      stream: async function* (_req: ChatRequest) {
        yield { delta: "Custom", done: false, provider: "my-custom", model: "custom-v1" };
        yield { delta: " stream", done: true, provider: "my-custom", model: "custom-v1" };
      },
      healthCheck: async () => ({
        provider: "my-custom",
        status: "up" as const,
        checkedAt: new Date(),
      }),
    });

    expect(ai.getAvailableProviders()).toContain("my-custom");
    const res = await ai.chat({ message: "Hi", provider: "my-custom" });
    expect(res.content).toBe("Custom response");
  });

  it("throws when registering a duplicate provider name", () => {
    const ai = makeAI();
    const plugin = {
      name: "dup-test",
      defaultModel: "m",
      isAvailable: () => true,
      chat: vi.fn(),
      stream: vi.fn(),
      healthCheck: vi.fn(),
    };
    ai.registerProvider(plugin);
    expect(() => ai.registerProvider(plugin)).toThrow("already registered");
  });

  it("unregisters a custom provider", () => {
    const ai = makeAI();
    ai.registerProvider({
      name: "temp-provider",
      defaultModel: "m",
      isAvailable: () => true,
      chat: vi.fn(),
      stream: vi.fn(),
      healthCheck: vi.fn(),
    });
    expect(ai.getProviders()).toContain("temp-provider");
    ai.unregisterProvider("temp-provider");
    expect(ai.getProviders()).not.toContain("temp-provider");
  });

  it("registered provider appears in available provider list", () => {
    const ai = makeAI();
    ai.registerProvider({
      name: "extra",
      defaultModel: "m",
      isAvailable: () => true,
      chat: vi.fn(),
      stream: vi.fn(),
      healthCheck: vi.fn(),
    });
    expect(ai.getAvailableProviders()).toContain("extra");
    // Built-in unconfigured providers must NOT appear
    expect(ai.getAvailableProviders()).not.toContain("groq");
    expect(ai.getAvailableProviders()).not.toContain("gemini");
  });
});
