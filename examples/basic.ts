/**
 * Vyrion Basic Usage Examples
 * Run with: npx tsx examples/basic.ts
 */
import Vyrion from "../src/index.js";

const ai = new Vyrion({
  openai: process.env["OPENAI_API_KEY"],
  groq: process.env["GROQ_API_KEY"],
  gemini: process.env["GEMINI_API_KEY"],
  anthropic: process.env["ANTHROPIC_API_KEY"],
  // Ollama runs locally — no key needed
  ollama: { baseUrl: "http://localhost:11434" },
});

// ── 1. Simple chat (auto-routing) ──────────────────────────────────────────────
async function exampleSimpleChat() {
  console.log("\n── Simple Chat (auto routing) ─────────────────");
  const res = await ai.chat({
    message: "What is recursion? Explain in 2 sentences.",
    provider: "auto",
  });
  console.log(`[${res.provider} / ${res.model}]`, res.content);
  console.log(`Tokens: ${res.usage.total} | Latency: ${res.latency}ms | Cost: $${res.cost}`);
}

// ── 2. Route by goal ──────────────────────────────────────────────────────────
async function exampleGoalRouting() {
  console.log("\n── Goal: fastest ─────────────────────────────");
  const fastest = await ai.chat({
    goal: "fastest",
    message: "Generate 5 JavaScript interview questions.",
  });
  console.log(`[${fastest.provider}]`, fastest.content.slice(0, 120), "...");

  console.log("\n── Goal: cheapest ───────────────────────────");
  const cheapest = await ai.chat({
    goal: "cheapest",
    message: "Summarise what a linked list is.",
  });
  console.log(`[${cheapest.provider}]`, cheapest.content.slice(0, 120), "...");
}

// ── 3. Target a specific provider ─────────────────────────────────────────────
async function exampleSpecificProvider() {
  console.log("\n── Specific Provider: Groq ────────────────────");
  const res = await ai.chat({
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    message: "Write a haiku about TypeScript.",
    temperature: 0.9,
  });
  console.log(`[${res.provider} / ${res.model}]`, res.content);
}

// ── 4. Streaming ───────────────────────────────────────────────────────────────
async function exampleStreaming() {
  console.log("\n── Streaming ─────────────────────────────────");
  process.stdout.write("[stream] ");
  for await (const chunk of ai.stream({
    message: "Tell me a fun fact about the universe.",
    provider: "auto",
  })) {
    process.stdout.write(chunk.delta);
  }
  console.log();
}

// ── 5. Multi-turn conversation ────────────────────────────────────────────────
async function exampleMultiTurn() {
  console.log("\n── Multi-turn Conversation ───────────────────");
  const res = await ai.chat({
    messages: [
      { role: "system", content: "You are a helpful coding assistant." },
      { role: "user", content: "What is a closure in JavaScript?" },
      { role: "assistant", content: "A closure is a function that has access to its outer scope even after the outer function has returned." },
      { role: "user", content: "Give me a quick code example." },
    ],
    provider: "auto",
  });
  console.log(`[${res.provider}]`, res.content);
}

// ── 6. Custom provider registration ───────────────────────────────────────────
async function exampleCustomProvider() {
  console.log("\n── Custom Provider ───────────────────────────");

  ai.registerProvider({
    name: "echo",
    defaultModel: "echo-1",
    isAvailable: () => true,
    chat: async (req) => ({
      content: `ECHO: ${req.message ?? req.messages?.at(-1)?.content ?? ""}`,
      provider: "echo",
      model: "echo-1",
      usage: { prompt: 1, completion: 1, total: 2 },
      latency: 0,
      cost: 0,
      finishReason: "stop",
    }),
    stream: async function* (req) {
      yield { delta: `ECHO: ${req.message ?? ""}`, done: true, provider: "echo", model: "echo-1" };
    },
    healthCheck: async () => ({
      provider: "echo",
      status: "up",
      checkedAt: new Date(),
    }),
  });

  const res = await ai.chat({ message: "Hello Vyrion!", provider: "echo" });
  console.log(res.content);
}

// ── 7. Health check ───────────────────────────────────────────────────────────
async function exampleHealthCheck() {
  console.log("\n── Provider Health ───────────────────────────");
  const health = await ai.getProviderHealth();
  for (const h of health) {
    const icon = h.status === "up" ? "✅" : h.status === "down" ? "❌" : "⚠️";
    console.log(`${icon} ${h.provider}: ${h.status}${h.latency != null ? ` (${h.latency}ms)` : ""}`);
  }
}

// ── 8. Analytics ──────────────────────────────────────────────────────────────
async function exampleAnalytics() {
  console.log("\n── Analytics Snapshot ───────────────────────");
  const stats = ai.getStats();
  console.log(`Total requests: ${stats.totalRequests}`);
  console.log(`Total tokens: ${stats.totalTokens}`);
  console.log(`Total cost: $${stats.totalCost.toFixed(6)}`);
  for (const p of stats.providers) {
    console.log(
      `  ${p.provider}: ${p.requests} reqs, ${p.errors} errors, ${p.avgLatency}ms avg`
    );
  }
}

// ── 9. Multi-Modal (Images & Files) ───────────────────────────────────────────
async function exampleMultimodal() {
  console.log("\n── 9. Multi-Modal (Images & Files) ────────────");
  const hasKeys = process.env["OPENAI_API_KEY"] || process.env["GEMINI_API_KEY"] || process.env["ANTHROPIC_API_KEY"];
  if (!hasKeys) {
    console.log("Skipped: No API keys configured for OpenAI, Gemini, or Anthropic.");
    return;
  }

  const res = await ai.chat({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "What color is in this image?" },
          {
            type: "image",
            image: {
              url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
              mimeType: "image/png"
            }
          }
        ]
      }
    ],
  });
  console.log(`[${res.provider}]`, res.content);
}

// ── 10. Circuit Breaker & Automatic Cooldown ──────────────────────────────────
async function exampleCircuitBreaker() {
  console.log("\n── 10. Circuit Breaker & Cooldown ──────────────");
  
  // Set up a custom client with quick circuit breaker settings
  const circuitClient = new Vyrion({
    openai: "invalid-key-to-force-fail",
    circuitBreaker: {
      failuresThreshold: 2, // trip after 2 consecutive failures
      cooldownMs: 5000,     // 5 seconds cooldown
    }
  });

  console.log("Making request 1 (fails)...");
  try {
    await circuitClient.chat({ provider: "openai", message: "Hello" });
  } catch (err) {
    console.log("Request 1 failed as expected: OpenAI key is invalid.");
  }

  console.log("Making request 2 (fails -> trips circuit)...");
  try {
    await circuitClient.chat({ provider: "openai", message: "Hello" });
  } catch (err) {
    console.log("Request 2 failed as expected: OpenAI key is invalid. Circuit tripped!");
  }

  console.log("Making request 3 (instantly bypassed!)...");
  try {
    await circuitClient.chat({ provider: "openai", message: "Hello" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("Request 3 failed instantly: " + msg);
  }
}

// ── 11. Streaming Caching & Playback ──────────────────────────────────────────
async function exampleStreamingCache() {
  console.log("\n── 11. Streaming Caching & Playback ───────────");
  
  const cachedClient = new Vyrion({
    openai: "sk-test",
    cache: true, // Enable built-in cache
  });

  let mockCalls = 0;
  cachedClient.registerProvider({
    name: "mock-stream-provider",
    defaultModel: "model-s",
    isAvailable: () => true,
    chat: async () => ({
      content: "Chat result",
      provider: "mock-stream-provider",
      model: "model-s",
      usage: { prompt: 1, completion: 1, total: 2 },
      latency: 5,
      cost: 0,
      finishReason: "stop",
    }),
    stream: async function* () {
      mockCalls++;
      yield { delta: "Hello", done: false, provider: "mock-stream-provider", model: "model-s" };
      yield { delta: " from", done: false, provider: "mock-stream-provider", model: "model-s" };
      yield { delta: " Vyrion's", done: false, provider: "mock-stream-provider", model: "model-s" };
      yield { delta: " cached", done: false, provider: "mock-stream-provider", model: "model-s" };
      yield { delta: " stream!", done: true, provider: "mock-stream-provider", model: "model-s" };
    },
    healthCheck: async () => ({ provider: "mock-stream-provider", status: "up", checkedAt: new Date() }),
  });

  console.log("Streaming request 1 (Cache Miss - Live):");
  process.stdout.write("[live] ");
  for await (const chunk of cachedClient.stream({ message: "stream-cache-demo", provider: "mock-stream-provider" })) {
    process.stdout.write(chunk.delta);
  }
  console.log();

  console.log("\nStreaming request 2 (Cache Hit - Playback with 15ms delay):");
  const start = Date.now();
  process.stdout.write("[playback] ");
  for await (const chunk of cachedClient.stream({ message: "stream-cache-demo", provider: "mock-stream-provider" })) {
    process.stdout.write(chunk.delta);
  }
  console.log(`\n(Simulated playback took ${Date.now() - start}ms)`);
  console.log(`Total direct provider stream calls: ${mockCalls}`);
}

// ── Run all examples ──────────────────────────────────────────────────────────
(async () => {
  try {
    await exampleSimpleChat();
    await exampleGoalRouting();
    await exampleSpecificProvider();
    await exampleStreaming();
    await exampleMultiTurn();
    await exampleCustomProvider();
    await exampleHealthCheck();
    await exampleAnalytics();
    await exampleMultimodal();
    await exampleCircuitBreaker();
    await exampleStreamingCache();
  } catch (err) {
    console.error("Example failed:", err);
    process.exit(1);
  }
})();
