<p align="center">
  <img src="https://mincr.in/vyrion/banner.svg" alt="Vyrion" width="720" />
</p>

<h1 align="center">Vyrion</h1>
<p align="center"><strong>One intelligent runtime for every LLM.</strong></p>
<p align="center">
  <a href="https://www.npmjs.com/package/@mincrypt/vyrion"><img src="https://img.shields.io/npm/v/@mincrypt/vyrion?color=6366f1&style=flat-square" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@mincrypt/vyrion"><img src="https://img.shields.io/npm/dm/@mincrypt/vyrion?color=8b5cf6&style=flat-square" alt="downloads" /></a>
  <a href="https://github.com/mincrypt/vyrion/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@mincrypt/vyrion?color=10b981&style=flat-square" alt="license" /></a>
  <a href="https://mincr.in"><img src="https://img.shields.io/badge/Powered%20by-Mincr%20Technology-6366f1?style=flat-square" alt="Powered by Mincr Technology" /></a>
</p>

<p align="center">
  Vyrion is a lightweight TypeScript/Node.js package that provides a <strong>unified interface</strong> for every major AI provider — OpenAI, Groq, Gemini, Anthropic, Mistral, Together AI, Ollama, and custom providers.<br/>
  Built and maintained by <a href="https://mincr.in"><strong>Mincr Technology</strong></a>.
</p>

---

## Why Vyrion?

Modern AI applications depend on multiple LLM providers. Each has different SDKs, API structures, streaming methods, authentication mechanisms, and pricing models. Switching providers requires code changes and maintenance.

**Vyrion solves this.** Write your AI code once. Run it everywhere. Optimise automatically.

```typescript
import Vyrion from "@mincrypt/vyrion";

const ai = new Vyrion({
  openai: process.env.OPENAI_API_KEY,
  groq: process.env.GROQ_API_KEY,
});

const res = await ai.chat({
  message: "Explain recursion in one sentence.",
  goal: "fastest",
});

console.log(res.content);
// → "Recursion is a technique where a function calls itself..."
console.log(`[${res.provider} / ${res.model}] ${res.latency}ms · $${res.cost}`);
```

---

## Features

| Feature | Description |
|---|---|
| **Unified Chat API** | One interface for all providers |
| **Smart Routing** | `auto`, `fastest`, `cheapest`, `best` strategies |
| **Auto Failover** | OpenAI → Groq → Gemini → Anthropic → Mistral, automatically |
| **Streaming** | Unified `AsyncGenerator` across all providers |
| **Usage Analytics** | Tokens, latency, request counts per provider |
| **Cost Monitoring** | Real-time USD cost estimation |
| **Health Checks** | Per-provider status monitoring |
| **Local Models** | Ollama support with zero API key required |
| **Plugin System** | Register fully custom providers |
| **TypeScript** | Full type safety, dual ESM/CJS build |

---

## Supported Providers

| Provider | Key Needed | Notable Models |
|---|---|---|
| OpenAI | ✅ | `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini` |
| Groq | ✅ | `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` |
| Google Gemini | ✅ | `gemini-2.0-flash`, `gemini-2.5-pro-preview` |
| Anthropic | ✅ | `claude-3-5-sonnet-latest`, `claude-3-5-haiku-latest` |
| Mistral | ✅ | `mistral-large-latest`, `codestral-latest` |
| Together AI | ✅ | `meta-llama/Llama-3-70b-chat-hf`, `Qwen2-72B` |
| Ollama (local) | ❌ | `llama3.2`, `phi4`, `mistral`, `gemma3` |
| Custom | — | Register via `ai.registerProvider()` |

---

## Installation

```bash
npm install @mincrypt/vyrion
```

Install only the provider SDKs you need:

```bash
# Install what you use — all are optional
npm install openai              # OpenAI + Together AI
npm install groq-sdk            # Groq
npm install @google/genai       # Gemini
npm install @anthropic-ai/sdk   # Anthropic
npm install @mistralai/mistralai # Mistral
# Ollama — no SDK needed (uses native fetch)
```

> **Note**: Vyrion uses dynamic imports — only the SDKs you install will be loaded at runtime. Uninstalled SDKs are silently skipped.

---

## Quick Start

### Minimal (single provider)

```typescript
import Vyrion from "@mincrypt/vyrion";

// Only configure what you have
const ai = new Vyrion({ groq: process.env.GROQ_API_KEY });

const res = await ai.chat({ message: "Hello, world!" });
console.log(res.content);
```

### Multiple providers with auto-routing

```typescript
import Vyrion from "@mincrypt/vyrion";

const ai = new Vyrion({
  openai: process.env.OPENAI_API_KEY,
  groq: process.env.GROQ_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
});

// Vyrion picks the best available provider automatically
const res = await ai.chat({
  message: "What is the capital of France?",
  provider: "auto",
});
```

---

## Configuration

```typescript
const ai = new Vyrion({
  // Simple: just the API key string
  openai: "sk-...",
  groq: "gsk_...",

  // Advanced: full config object
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    timeout: 15_000,
    defaultModel: "gemini-2.5-pro-preview-06-05",
  },

  // Ollama (local, no API key needed)
  ollama: {
    baseUrl: "http://localhost:11434", // default
  },

  // Global settings
  timeout: 30_000,           // default timeout for all providers
  defaultGoal: "fastest",    // default routing strategy
  fallback: ["openai", "groq", "gemini"], // custom fallback order
});
```

> [!IMPORTANT]
> **At least one provider must be configured.** If no providers are specified, Vyrion throws a helpful error at construction time:
> ```
> No active providers found. Please configure at least one provider API key.
>
> Examples:
>   const ai = new Vyrion({ openai: process.env.OPENAI_API_KEY });
>   const ai = new Vyrion({ groq: process.env.GROQ_API_KEY });
> ```

---

## API Reference

### `ai.chat(request)` → `Promise<ChatResponse>`

```typescript
const res = await ai.chat({
  message: "Write a sorting algorithm",    // single-turn
  // OR
  messages: [                              // multi-turn
    { role: "system", content: "You are a coding assistant." },
    { role: "user", content: "Write a sorting algorithm" },
  ],

  provider: "auto",     // "auto" | "openai" | "groq" | "gemini" | ...
  goal: "fastest",      // "auto" | "fastest" | "cheapest" | "best"
  model: "gpt-4o",      // override default model
  maxTokens: 1024,
  temperature: 0.7,
  systemPrompt: "Be concise.",
  fallback: ["groq", "gemini"], // per-request fallback override
});

console.log(res.content);    // generated text
console.log(res.provider);   // "openai"
console.log(res.model);      // "gpt-4o-mini"
console.log(res.usage);      // { prompt: 12, completion: 48, total: 60 }
console.log(res.latency);    // 342 (ms)
console.log(res.cost);       // 0.000012 (USD)
```

### `ai.stream(request)` → `AsyncGenerator<StreamChunk>`

```typescript
for await (const chunk of ai.stream({ message: "Tell me a story" })) {
  process.stdout.write(chunk.delta);
  if (chunk.done) break;
}
```

---

## Routing Goals

| Goal | Behaviour |
|---|---|
| `"auto"` | Tries configured providers in a sensible priority order |
| `"fastest"` | Picks the provider with the lowest recent average latency |
| `"cheapest"` | Picks Ollama → Groq → Together → Gemini → Mistral → Anthropic → OpenAI |
| `"best"` | Picks OpenAI → Anthropic → Gemini → Mistral → Groq → Together → Ollama |

```typescript
const res = await ai.chat({
  goal: "fastest",
  message: "Generate interview questions for Node.js",
});
```

---

## Auto Failover

If a provider fails, Vyrion automatically tries the next one in the chain:

```typescript
const res = await ai.chat({
  provider: "openai",
  message: "Hello",
  fallback: ["groq", "gemini", "anthropic"],
});
// If OpenAI fails → tries Groq → Gemini → Anthropic
```

Default fallback chain (when `provider: "auto"`):
**OpenAI → Groq → Gemini → Anthropic → Mistral → Together → Ollama**

Error message when all fail:
```
All configured providers failed. Last error: ...
Providers tried: openai → groq → gemini
```

---

## Analytics

```typescript
const stats = ai.getStats();

console.log(`Total requests: ${stats.totalRequests}`);
console.log(`Total cost: $${stats.totalCost.toFixed(4)}`);

for (const provider of stats.providers) {
  console.log(`${provider.provider}: ${provider.requests} reqs, ${provider.avgLatency}ms avg, $${provider.totalCost.toFixed(6)}`);
}

// Reset counters
ai.resetStats();

// Cumulative cost shortcut
const totalUSD = ai.getTotalCost();
```

---

## Health Monitoring

```typescript
// One-time check of all configured providers
const health = await ai.getProviderHealth();
for (const h of health) {
  const icon = h.status === "up" ? "✅" : "❌";
  console.log(`${icon} ${h.provider}: ${h.status} (${h.latency}ms)`);
}

// Background monitoring (pings every 5 minutes by default)
ai.startHealthMonitor();
ai.startHealthMonitor(60_000); // every 60 seconds

ai.stopHealthMonitor();
```

---

## Custom Providers (Plugin System)

```typescript
ai.registerProvider({
  name: "my-api",
  defaultModel: "my-model-v1",
  isAvailable: () => true,

  async chat(req) {
    const response = await myCustomAPI.complete(req.message);
    return {
      content: response.text,
      provider: "my-api",
      model: "my-model-v1",
      usage: { prompt: 0, completion: 0, total: 0 },
      latency: response.duration,
      cost: 0,
      finishReason: "stop",
    };
  },

  async *stream(req) {
    for await (const chunk of myCustomAPI.stream(req.message)) {
      yield { delta: chunk.text, done: chunk.finished, provider: "my-api", model: "my-model-v1" };
    }
  },

  async healthCheck() {
    const ok = await myCustomAPI.ping();
    return { provider: "my-api", status: ok ? "up" : "down", checkedAt: new Date() };
  },
});

// Custom providers work identically to built-in ones
const res = await ai.chat({ message: "Hello", provider: "my-api" });

// Remove when no longer needed
ai.unregisterProvider("my-api");
```

---

## Pricing Overrides

```typescript
// Override when providers update their rates
ai.setPricing("openai", "gpt-5", {
  inputPer1M: 10.00,
  outputPer1M: 30.00,
});

// See current pricing table
const table = ai.getPricing("openai");
```

---

## TypeScript Types

All types are exported from the package root:

```typescript
import type {
  VyrionConfig,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  AnalyticsSnapshot,
  HealthCheckResult,
  ProviderPlugin,
  TokenUsage,
  RoutingGoal,
  ModelPricing,
  Message,
} from "@mincrypt/vyrion";
```

---

## Roadmap

| Version | Status | Features |
|---|---|---|
| **v1** | ✅ Current | OpenAI, Groq, Gemini, Anthropic, Mistral, Together AI, Ollama · Unified Chat API · Streaming · Fallback · Cost Estimation · TypeScript |
| **v2** | 🔜 Planned | Analytics dashboard · Cost reports · Team monitoring |
| **v3** | 🔜 Planned | LM Studio · Advanced health monitoring · Vyrion Cloud |
| **v4** | 🔜 Planned | Agent mode · Tool calling · Vyrion Plugin Ecosystem |

---

## Business Model

Vyrion follows a **Bring Your Own Key (BYOK)** model. You provide your own API keys directly — Vyrion never stores, proxies, or manages your credentials.

Future Mincr Technology products will extend Vyrion with:
- **Vyrion Cloud** — hosted analytics, cost dashboards, and team monitoring
- **Vyrion Studio** — visual workflow builder
- **Vyrion Agents** — agent orchestration built on this core SDK

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Run tests: `npm test`
4. Submit a pull request to [github.com/mincrypt/vyrion](https://github.com/mincrypt/vyrion)

---

## License

MIT © [Mincr Technology](https://mincr.in)

---

<p align="center">
  <strong>Powered by Mincr Technology</strong> · <a href="https://mincr.in">mincr.in</a>
</p>
