<p align="center">
  <img src="https://mincr.in/vyrion/banner.png" alt="Vyrion" width="720" />
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
| **Middleware** | Onion-style interceptors to monitor/modify request/response pipeline |
| **Custom Caching** | Extensible cache engine with built-in memory store and Redis/Custom support |
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
  cache: true,               // enable built-in memory cache (or custom ICache)
  middleware: [],            // array of global middlewares
  circuitBreaker: {          // customize automatic cooldowns
    failuresThreshold: 2,
    cooldownMs: 30_000,
  }
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

### Global Configuration (`VyrionConfig`)

Passed to `new Vyrion(config)`:

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `openai` | `string \| ProviderConfig` | `undefined` | OpenAI API Key or full provider configuration. |
| `groq` | `string \| ProviderConfig` | `undefined` | Groq API Key or full provider configuration. |
| `gemini` | `string \| ProviderConfig` | `undefined` | Google Gemini API Key or full provider configuration. |
| `anthropic` | `string \| ProviderConfig` | `undefined` | Anthropic Claude API Key or full provider configuration. |
| `mistral` | `string \| ProviderConfig` | `undefined` | Mistral API Key or full provider configuration. |
| `together` | `string \| ProviderConfig` | `undefined` | Together AI API Key or full provider configuration. |
| `ollama` | `string \| ProviderConfig` | `undefined` | Ollama local configuration (no API key required). |
| `timeout` | `number` | `30000` | Global request timeout in milliseconds (can be overridden per-provider). |
| `fallback` | `string[]` | *(standard priority list)* | Priority list of fallback providers when checking auto routing failovers. |
| `defaultGoal` | `RoutingGoal` | `"auto"` | Default routing strategy if target provider is `"auto"`. |
| `cache` | `boolean \| ICache` | `false` | Enables default memory cache or registers a custom cache backend. |
| `middleware` | `Middleware[]` | `[]` | Array of global Onion-style middleware interceptor functions. |
| `circuitBreaker` | `CircuitBreakerConfig` | `undefined` | Settings for automatic rate limiting failovers and cooldowns. |

### Provider Configuration (`ProviderConfig`)

Can be passed to configure specific providers (e.g. `gemini: { ... }`):

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `apiKey` | `string` | `undefined` | Provider API authentication key. |
| `baseUrl` | `string` | `undefined` | Overrides base API url. Useful for proxies, local mock testing, or server setups. |
| `timeout` | `number` | `30000` | Specific API request timeout in milliseconds for this provider. |
| `defaultModel` | `string` | *(provider default)* | Overrides default provider model name used when none is specified. |

### Circuit Breaker Configuration (`CircuitBreakerConfig`)

Passed inside `config.circuitBreaker`:

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `failuresThreshold` | `number` | `3` | Number of sequential failed attempts before tripping the circuit. |
| `cooldownMs` | `number` | `60000` | Time window (in milliseconds) the provider is bypassed before attempting recovery. |

---

## Request Configuration Reference (`ChatRequest`)

Passed to `ai.chat(request)` and `ai.stream(request)`:

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `message` | `string` | `undefined` | Single prompt text message (shorthand helper). |
| `messages` | `Message[]` | `[]` | Full multi-turn dialog history. Supports text/image/file multi-modal parts. |
| `systemPrompt` | `string` | `undefined` | System instruction prompt to prepended to messages. |
| `provider` | `string` | `"auto"` | Target provider name (e.g., `"openai"`) or `"auto"` to use routing strategy. |
| `model` | `string` | *(varies)* | Specific model name to override provider default. |
| `goal` | `RoutingGoal` | `"auto"` | Strategy for picking provider when `provider` is `"auto"`. |
| `fallback` | `string[]` | *(global list)* | Override fallback list order for failed requests. |
| `maxTokens` | `number` | `undefined` | Maximum token length for generated completion text. |
| `temperature` | `number` | `undefined` | Sampling temperature between 0 and 2. |
| `stream` | `boolean` | `false` | Set to `true` to return an async stream generator. |
| `signal` | `AbortSignal` | `undefined` | Abort signal to cancel request/stream mid-way. |
| `cache` | `boolean` | `true` | Set to `false` to force bypass caching on this request. |
| `tools` | `ToolDefinition[]` | `[]` | Unified tool definitions available to the model. |
| `responseFormat` | `"json" \| ResponseFormat` | `undefined` | Enforces structural output type (JSON schema). |

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

### Custom Routing Strategies

You can also pass a custom function to the `goal` parameter (or `defaultGoal` in the constructor config) to control routing logic dynamically:

```typescript
const myCustomStrategy = (providers, analytics) => {
  // Always use together AI if available, else fallback to the first provider
  const target = providers.find((p) => p.name === "together");
  return target ?? providers[0];
};

const res = await ai.chat({
  message: "Hello",
  provider: "auto",
  goal: myCustomStrategy,
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

## Middleware (Interceptor) System

Vyrion features an onion-style middleware engine (inspired by Koa-compose) that executes around the request lifecycle. Middlewares can be configured globally via the `Vyrion` constructor or registered dynamically using `.use()`.

With middlewares, you can log requests, modify inputs, intercept responses, short-circuit execution, or catch provider errors.

```typescript
import Vyrion from "@mincrypt/vyrion";

const ai = new Vyrion({ openai: "sk-..." });

// 1. Logging Middleware
ai.use(async (ctx, next) => {
  console.log(`Starting request to provider: ${ctx.request.provider ?? 'auto'}`);
  const start = Date.now();
  const res = await next();
  console.log(`Finished in ${Date.now() - start}ms`);
  return res;
});

// 2. Modifying Request Middleware
ai.use(async (ctx, next) => {
  ctx.request.message = `[Prefix] ${ctx.request.message}`;
  return next();
});

// 3. Short-circuiting Middleware (bypass providers)
ai.use(async (ctx, next) => {
  if (ctx.request.message?.includes("ping")) {
    return {
      content: "pong",
      provider: "middleware-mock",
      model: "mock-model",
      usage: { prompt: 0, completion: 0, total: 0 },
      latency: 0,
      cost: 0,
      finishReason: "stop",
    };
  }
  return next();
});
```

---

## Customizable Caching System

Vyrion comes with an extensible caching system for non-streaming (`chat()`) requests. It includes a built-in `InMemoryCache` and supports any custom cache store (like Redis, Memcached, or SQLite) that implements the simple `ICache` interface.

### Using Built-in In-memory Cache

```typescript
import Vyrion from "@mincrypt/vyrion";

const ai = new Vyrion({
  openai: "sk-...",
  cache: true, // Enables default InMemoryCache (expires in 5 minutes by default)
});

// The first request fetches from OpenAI and caches the result
const res1 = await ai.chat({ message: "What is 2+2?" });

// The second request resolves instantly from the cache
const res2 = await ai.chat({ message: "What is 2+2?" });
```

### Bypassing Cache for a Request

You can bypass the cache dynamically on a per-request basis:

```typescript
const res = await ai.chat({
  message: "What is 2+2?",
  cache: false, // Bypasses cache and hits the provider directly
});
```

### Custom Cache Backend (e.g. Redis)

To use your own caching backend, implement the `ICache` interface and pass it to the `cache` property:

```typescript
import Vyrion, { ICache } from "@mincrypt/vyrion";
import { createClient } from "redis";

const redisClient = createClient();
await redisClient.connect();

const redisCache: ICache = {
  async get(key) {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  },
  async set(key, value, ttl) {
    // ttl is in seconds
    if (ttl) {
      await redisClient.set(key, JSON.stringify(value), { EX: ttl });
    } else {
      await redisClient.set(key, JSON.stringify(value));
    }
  },
  async delete(key) {
    await redisClient.del(key);
  }
};

const ai = new Vyrion({
  openai: "sk-...",
  cache: redisCache, // Plug in your Redis cache
});
```

---

## Unified Tool Calling & Structured Outputs

Vyrion provides a unified API for **Function Calling (Tools)** and **Structured Outputs** (JSON Schema / Object modes) across all major built-in providers (OpenAI, Gemini, Anthropic, Groq, Together, Mistral, Ollama). 

For custom providers, tool definitions and schema parameters are safely forwarded inside the request, making implementation entirely optional and flexible.

### 1. Tool Calling (Function Calling)

You can pass standard tool definitions (JSON Schema format) in `ChatRequest.tools`. If the model decides to invoke a tool, Vyrion returns them in a normalized format:

```typescript
const res = await ai.chat({
  message: "What's the weather in Paris?",
  tools: [
    {
      name: "getWeather",
      description: "Get the current weather for a location",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string" },
          unit: { type: "string", enum: ["celsius", "fahrenheit"] }
        },
        required: ["location"]
      }
    }
  ]
});

if (res.toolCalls) {
  for (const call of res.toolCalls) {
    console.log(`Model requested tool: ${call.function.name}`);
    console.log(`Arguments: ${call.function.arguments}`);
    // Output: Model requested tool: getWeather
    // Output: Arguments: {"location":"Paris"}
  }
}
```

### 2. Structured JSON Output

You can enforce the model to output a strict JSON object structure by specifying `responseFormat`:

```typescript
const res = await ai.chat({
  message: "List 3 colors and their hex codes",
  responseFormat: {
    type: "json_schema",
    schema: {
      type: "object",
      properties: {
        colors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              hex: { type: "string" }
            },
            required: ["name", "hex"]
          }
        }
      },
      required: ["colors"]
    }
  }
});

// Vyrion automatically parses the JSON response into the 'json' field
console.log(res.json);
// Output: { colors: [ { name: "red", hex: "#FF0000" }, ... ] }
```

---

## Multi-Modal & Document Support (Images, PDFs & Documents)

Vyrion supports multi-modal conversations where messages can accept an array of text, image, and file content parts. The package intelligently translates these inputs to each provider's native format:

* **Google Gemini**: Natively translates images and document formats (PDFs, Word documents, text files, CSVs, etc.) directly using inline base64 data.
* **Anthropic Claude**: Natively translates images and PDF documents to their respective block types, and decodes text-based attachments.
* **OpenAI**: Natively translates images to `image_url` parts, decodes text files inline, and throws clear, descriptive errors for unsupported binary files (like PDFs).

### Example: Multi-modal Message

```typescript
const res = await ai.chat({
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Summarize this PDF document and describe the image:" },
        {
          type: "file",
          file: {
            url: "data:application/pdf;base64,JVBERi0xLjQK...", // base64 representation of PDF
            mimeType: "application/pdf"
          }
        },
        {
          type: "image",
          image: {
            url: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...", // base64 representation of image
            mimeType: "image/jpeg"
          }
        }
      ]
    }
  ]
});
```

---

## Circuit Breaker & Automatic Cooldown

Vyrion features a built-in **Circuit Breaker** to protect your application from rate-limiting (HTTP 429) or transient provider outages. When a provider encounters sequential errors exceeding your threshold (or throws an HTTP 429 rate limit error), the circuit breaker trips and marks the provider as degraded.

During fallback routing, degraded providers are bypassed, and traffic is directed to alternate active providers for a configured cooldown duration.

### Configuring Circuit Breaker

```typescript
import Vyrion from "@mincrypt/vyrion";

const ai = new Vyrion({
  openai: process.env.OPENAI_API_KEY,
  groq: process.env.GROQ_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
  
  // Configure circuit breaker settings
  circuitBreaker: {
    failuresThreshold: 3,  // Number of consecutive errors before tripping (default: 3)
    cooldownMs: 60_000,    // Duration (in milliseconds) to bypass the provider (default: 60s)
  }
});
```

---

## Streaming Caching & Playback

When caching is enabled, Vyrion caches the responses of both `chat()` and `stream()` requests. 

For streaming requests (`stream()`), the full sequence of response chunks is captured on a cache-miss. On a cache-hit, Vyrion plays back the cached stream chunks in order with a simulated **15ms timing delay** per chunk, preserving a smooth, real-time streaming user experience.

Streaming caching is fully transparent:

```typescript
const ai = new Vyrion({
  openai: "sk-...",
  cache: true, // Enables default memory caching for chat and stream
});

// Cache miss: streams from OpenAI and saves chunks
for await (const chunk of ai.stream({ message: "Write a poem" })) {
  process.stdout.write(chunk.delta);
}

// Cache hit: plays back chunks instantly with smooth simulated 15ms timing
for await (const chunk of ai.stream({ message: "Write a poem" })) {
  process.stdout.write(chunk.delta);
}
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
  ICache,
  Middleware,
  MiddlewareContext,
  MiddlewareNext,
  ToolDefinition,
  ToolCall,
  ResponseFormat,
  MessageContentPart,
  CircuitBreakerConfig,
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
