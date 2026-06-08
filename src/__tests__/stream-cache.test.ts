import { describe, it, expect } from "vitest";
import Vyrion from "../index.js";

describe("Streaming Caching & Playback", () => {
  it("should stream from provider first, cache it, and play back from cache on second call", async () => {
    let callCount = 0;
    const ai = new Vyrion({
      openai: "sk-test",
      cache: true,
    });

    ai.registerProvider({
      name: "stream-provider",
      defaultModel: "model-s",
      isAvailable: () => true,
      chat: async () => {
        return {
          content: "Chat result",
          provider: "stream-provider",
          model: "model-s",
          usage: { prompt: 1, completion: 1, total: 2 },
          latency: 5,
          cost: 0,
          finishReason: "stop",
        };
      },
      stream: async function* () {
        callCount++;
        yield { delta: "Hello", done: false, provider: "stream-provider", model: "model-s" };
        yield { delta: " world", done: false, provider: "stream-provider", model: "model-s" };
        yield { delta: "", done: true, provider: "stream-provider", model: "model-s" };
      },
      healthCheck: async () => ({ provider: "stream-provider", status: "up", checkedAt: new Date() }),
    });

    // First stream: cache miss, calls stream provider
    const chunks1 = [];
    for await (const chunk of ai.stream({ message: "Hello stream", provider: "stream-provider" })) {
      chunks1.push(chunk);
    }

    expect(callCount).toBe(1);
    expect(chunks1).toHaveLength(3);
    expect(chunks1[0].delta).toBe("Hello");
    expect(chunks1[1].delta).toBe(" world");

    // Second stream: cache hit! Should not call provider, and play back with ~15ms delay per chunk
    const chunks2 = [];
    const startTime2 = Date.now();
    for await (const chunk of ai.stream({ message: "Hello stream", provider: "stream-provider" })) {
      chunks2.push(chunk);
    }
    const elapsed2 = Date.now() - startTime2;

    expect(callCount).toBe(1); // Provider stream should not be called again
    expect(chunks2).toHaveLength(3);
    expect(chunks2[0].delta).toBe("Hello");
    expect(chunks2[1].delta).toBe(" world");
    // Since we yield 3 chunks, and we sleep 15ms after yielding each chunk:
    // the total elapsed time should be at least 2 * 15ms = 30ms (first chunk + 15ms + second chunk + 15ms + third chunk + 15ms).
    expect(elapsed2).toBeGreaterThanOrEqual(30);
  });
});
