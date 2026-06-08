import { describe, it, expect, vi, beforeEach } from "vitest";
import Vyrion from "../index.js";
import { InMemoryCache } from "../cache/index.js";
import type { ICache, ChatResponse, ChatRequest } from "../types/index.js";

// Mock the OpenAI module so no real network calls happen
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

describe("InMemoryCache", () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
  });

  it("should set and get values", () => {
    const val: ChatResponse = {
      content: "Test content",
      provider: "test",
      model: "model-a",
      usage: { prompt: 1, completion: 1, total: 2 },
      latency: 10,
      cost: 0,
      finishReason: "stop",
    };
    cache.set("key-1", val);
    expect(cache.get("key-1")).toEqual(val);
  });

  it("should return null for non-existent keys", () => {
    expect(cache.get("non-existent")).toBeNull();
  });

  it("should respect TTL and expire entries", async () => {
    const val: ChatResponse = {
      content: "Test TTL",
      provider: "test",
      model: "model-a",
      usage: { prompt: 1, completion: 1, total: 2 },
      latency: 10,
      cost: 0,
      finishReason: "stop",
    };
    // TTL of 0.05 seconds = 50ms
    cache.set("key-ttl", val, 0.05);
    expect(cache.get("key-ttl")).toEqual(val);

    // Wait 60ms
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(cache.get("key-ttl")).toBeNull();
  });

  it("should allow deleting and clearing entries", () => {
    const val: ChatResponse = {
      content: "Test",
      provider: "test",
      model: "model-a",
      usage: { prompt: 1, completion: 1, total: 2 },
      latency: 10,
      cost: 0,
      finishReason: "stop",
    };
    cache.set("key-1", val);
    cache.set("key-2", val);

    cache.delete("key-1");
    expect(cache.get("key-1")).toBeNull();
    expect(cache.get("key-2")).toEqual(val);

    cache.clear();
    expect(cache.get("key-2")).toBeNull();
  });
});

describe("Vyrion Integration with Cache", () => {
  it("should cache responses when cache is enabled in VyrionConfig", async () => {
    let callCount = 0;
    const ai = new Vyrion({ openai: "sk-test" });

    // Register a provider that tracks call counts
    ai.registerProvider({
      name: "counting-provider",
      defaultModel: "model-v1",
      isAvailable: () => true,
      chat: async () => {
        callCount++;
        return {
          content: `Call count: ${callCount}`,
          provider: "counting-provider",
          model: "model-v1",
          usage: { prompt: 1, completion: 1, total: 2 },
          latency: 5,
          cost: 0,
          finishReason: "stop",
        };
      },
      stream: async function* () {},
      healthCheck: async () => ({ provider: "counting-provider", status: "up", checkedAt: new Date() }),
    });

    // Create a new instance with caching enabled (using our custom provider)
    const aiCached = new Vyrion({
      openai: "sk-test",
      cache: true,
    });
    aiCached.registerProvider({
      name: "counting-provider",
      defaultModel: "model-v1",
      isAvailable: () => true,
      chat: async () => {
        callCount++;
        return {
          content: `Call count: ${callCount}`,
          provider: "counting-provider",
          model: "model-v1",
          usage: { prompt: 1, completion: 1, total: 2 },
          latency: 5,
          cost: 0,
          finishReason: "stop",
        };
      },
      stream: async function* () {},
      healthCheck: async () => ({ provider: "counting-provider", status: "up", checkedAt: new Date() }),
    });

    // First call: should call the provider
    const res1 = await aiCached.chat({ message: "Hello", provider: "counting-provider" });
    expect(res1.content).toBe("Call count: 1");

    // Second call: should serve from cache, callCount remains 1
    const res2 = await aiCached.chat({ message: "Hello", provider: "counting-provider" });
    expect(res2.content).toBe("Call count: 1");
    expect(callCount).toBe(1);
  });

  it("should bypass cache if request explicitly sets cache: false", async () => {
    let callCount = 0;
    const aiCached = new Vyrion({
      openai: "sk-test",
      cache: true,
    });
    aiCached.registerProvider({
      name: "counting-provider",
      defaultModel: "model-v1",
      isAvailable: () => true,
      chat: async () => {
        callCount++;
        return {
          content: `Call count: ${callCount}`,
          provider: "counting-provider",
          model: "model-v1",
          usage: { prompt: 1, completion: 1, total: 2 },
          latency: 5,
          cost: 0,
          finishReason: "stop",
        };
      },
      stream: async function* () {},
      healthCheck: async () => ({ provider: "counting-provider", status: "up", checkedAt: new Date() }),
    });

    // First call: should call the provider
    const res1 = await aiCached.chat({ message: "Hello", provider: "counting-provider" });
    expect(res1.content).toBe("Call count: 1");

    // Second call with cache: false: should bypass cache and call provider
    const res2 = await aiCached.chat({ message: "Hello", provider: "counting-provider", cache: false });
    expect(res2.content).toBe("Call count: 2");
    expect(callCount).toBe(2);
  });

  it("should support custom cache backends (e.g. mock Redis/Database)", async () => {
    let callCount = 0;
    const customStore = new Map<string, string>();

    // Implement custom ICache
    const customCache: ICache = {
      get: (key: string) => {
        const data = customStore.get(key);
        return data ? JSON.parse(data) : null;
      },
      set: (key: string, value: ChatResponse, ttl?: number) => {
        customStore.set(key, JSON.stringify(value));
      },
    };

    const ai = new Vyrion({
      openai: "sk-test",
      cache: customCache,
    });

    ai.registerProvider({
      name: "custom-cache-provider",
      defaultModel: "model-a",
      isAvailable: () => true,
      chat: async () => {
        callCount++;
        return {
          content: `Response #${callCount}`,
          provider: "custom-cache-provider",
          model: "model-a",
          usage: { prompt: 1, completion: 1, total: 2 },
          latency: 5,
          cost: 0,
          finishReason: "stop",
        };
      },
      stream: async function* () {},
      healthCheck: async () => ({ provider: "custom-cache-provider", status: "up", checkedAt: new Date() }),
    });

    const res1 = await ai.chat({ message: "Hello", provider: "custom-cache-provider" });
    expect(res1.content).toBe("Response #1");
    expect(customStore.size).toBe(1);

    const res2 = await ai.chat({ message: "Hello", provider: "custom-cache-provider" });
    expect(res2.content).toBe("Response #1"); // From customCache
    expect(callCount).toBe(1);
  });
});
