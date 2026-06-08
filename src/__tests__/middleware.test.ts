import { describe, it, expect, vi, beforeEach } from "vitest";
import Vyrion from "../index.js";
import type { ChatRequest } from "../types/index.js";

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

describe("Vyrion Middleware System", () => {
  let ai: Vyrion;

  beforeEach(() => {
    ai = new Vyrion({ openai: "sk-test-key" });
  });

  it("should execute middleware in Onion style (before and after request)", async () => {
    const trace: string[] = [];

    ai.use(async (ctx, next) => {
      trace.push("m1-start");
      const res = await next();
      trace.push("m1-end");
      return res;
    });

    ai.use(async (ctx, next) => {
      trace.push("m2-start");
      const res = await next();
      trace.push("m2-end");
      return res;
    });

    const res = await ai.chat({ message: "Hello", provider: "openai" });
    expect(res.content).toBe("Mocked OpenAI response");
    expect(trace).toEqual(["m1-start", "m2-start", "m2-end", "m1-end"]);
  });

  it("should allow middleware to modify the request", async () => {
    ai.use(async (ctx, next) => {
      ctx.request.message = "Modified Message";
      return next();
    });

    // We can register a custom provider to verify it got the modified message
    ai.registerProvider({
      name: "spy-provider",
      defaultModel: "spy-model",
      isAvailable: () => true,
      chat: async (req: ChatRequest) => ({
        content: `Got: ${req.message}`,
        provider: "spy-provider",
        model: "spy-model",
        usage: { prompt: 5, completion: 10, total: 15 },
        latency: 50,
        cost: 0,
        finishReason: "stop",
      }),
      stream: async function* () {},
      healthCheck: async () => ({ provider: "spy-provider", status: "up", checkedAt: new Date() }),
    });

    const res = await ai.chat({ message: "Original Message", provider: "spy-provider" });
    expect(res.content).toBe("Got: Modified Message");
  });

  it("should allow middleware to modify the response", async () => {
    ai.use(async (ctx, next) => {
      const res = await next();
      res.content = "Intercepted: " + res.content;
      return res;
    });

    const res = await ai.chat({ message: "Hello", provider: "openai" });
    expect(res.content).toBe("Intercepted: Mocked OpenAI response");
  });

  it("should allow middleware to short-circuit and not call next()", async () => {
    ai.use(async (ctx, next) => {
      return {
        content: "Short-circuited!",
        provider: "short-circuit",
        model: "mock-model",
        usage: { prompt: 0, completion: 0, total: 0 },
        latency: 0,
        cost: 0,
        finishReason: "stop",
      };
    });

    const res = await ai.chat({ message: "Hello", provider: "openai" });
    expect(res.content).toBe("Short-circuited!");
    expect(res.provider).toBe("short-circuit");
  });

  it("should allow middleware to catch and handle errors", async () => {
    // Register a failing provider
    ai.registerProvider({
      name: "failing-provider",
      defaultModel: "fail-v1",
      isAvailable: () => true,
      chat: async () => {
        throw new Error("Provider failed!");
      },
      stream: async function* () {},
      healthCheck: async () => ({ provider: "failing-provider", status: "down", checkedAt: new Date() }),
    });

    ai.use(async (ctx, next) => {
      try {
        return await next();
      } catch (err) {
        return {
          content: `Recovered from: ${err instanceof Error ? err.message : String(err)}`,
          provider: "recovery-middleware",
          model: "recovery-model",
          usage: { prompt: 0, completion: 0, total: 0 },
          latency: 0,
          cost: 0,
          finishReason: "stop",
        };
      }
    });

    const res = await ai.chat({ message: "Hello", provider: "failing-provider", fallback: [] });
    expect(res.content).toContain("Provider failed!");
    expect(res.provider).toBe("recovery-middleware");
  });

  it("should support a custom routing strategy function passed to goal", async () => {
    // Register custom provider
    ai.registerProvider({
      name: "custom-router-provider",
      defaultModel: "model-v1",
      isAvailable: () => true,
      chat: async () => ({
        content: "Hello from custom routing!",
        provider: "custom-router-provider",
        model: "model-v1",
        usage: { prompt: 1, completion: 1, total: 2 },
        latency: 10,
        cost: 0,
        finishReason: "stop",
      }),
      stream: async function* () {},
      healthCheck: async () => ({ provider: "custom-router-provider", status: "up", checkedAt: new Date() }),
    });

    const customStrategy = (providers: any[]) => {
      const p = providers.find((pr) => pr.name === "custom-router-provider");
      return p ?? providers[0];
    };

    const res = await ai.chat({
      message: "Hello",
      provider: "auto",
      goal: customStrategy,
    });

    expect(res.provider).toBe("custom-router-provider");
    expect(res.content).toBe("Hello from custom routing!");
  });
});
