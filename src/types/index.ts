// ─────────────────────────────────────────────────────────────
//  Vyrion by Mincr Technology — Core Type Definitions
//  https://mincr.in/vyrion
// ─────────────────────────────────────────────────────────────

export interface MessageContentPart {
  type: "text" | "image" | "file";
  text?: string;
  image?: {
    url: string;
    mimeType?: string;
  };
  file?: {
    url: string;
    mimeType: string;
  };
}

/** A single message in a multi-turn conversation */
export interface Message {
  role: "system" | "user" | "assistant";
  content: string | MessageContentPart[];
}

/** Token usage breakdown returned in every response */
export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface ICache {
  get(key: string): Promise<ChatResponse | null> | ChatResponse | null;
  set(key: string, value: ChatResponse, ttl?: number): Promise<void> | void;
  delete?(key: string): Promise<void> | void;
  clear?(): Promise<void> | void;
}

export interface MiddlewareContext {
  request: ChatRequest;
}

export type MiddlewareNext = () => Promise<ChatResponse>;

export type Middleware = (
  ctx: MiddlewareContext,
  next: MiddlewareNext
) => Promise<ChatResponse>;

export interface ToolDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ResponseFormat {
  type: "text" | "json_object" | "json_schema";
  schema?: Record<string, any>;
}

/** Routing goal / strategy */
export type RoutingGoal = "auto" | "fastest" | "cheapest" | "best" | ((providers: any[], analytics: any) => any);

/**
 * Request object passed to ai.chat() / ai.stream()
 */
export interface ChatRequest {
  /** The user message (shorthand for single-turn usage) */
  message?: string;
  /** Full multi-turn message history. Overrides `message` if provided. */
  messages?: Message[];
  /** System prompt to prepend */
  systemPrompt?: string;
  /** Target provider name or "auto" to let the router decide */
  provider?: string;
  /** Specific model to use (overrides the provider default) */
  model?: string;
  /** Routing strategy when provider is "auto" */
  goal?: RoutingGoal;
  /** Ordered list of fallback providers on failure */
  fallback?: string[];
  /** Max tokens for the completion */
  maxTokens?: number;
  /** Sampling temperature (0–2) */
  temperature?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Custom request-level cache setting (true to enable, false to disable) */
  cache?: boolean;
  /** List of tools available to the model */
  tools?: ToolDefinition[];
  /** Expected response format (e.g. JSON object or schema) */
  responseFormat?: "json" | ResponseFormat;
}

/**
 * Normalised response from any provider
 */
export interface ChatResponse {
  /** The generated text content */
  content: string;
  /** Provider that served this request */
  provider: string;
  /** Model that was used */
  model: string;
  /** Token usage */
  usage: TokenUsage;
  /** Round-trip latency in milliseconds */
  latency: number;
  /** Estimated cost in USD */
  cost: number;
  /** Finish reason (stop | length | content_filter | ...) */
  finishReason: string;
  /** Parsed tool calls requested by the model */
  toolCalls?: ToolCall[];
  /** Parsed JSON response if JSON formatting was requested and successful */
  json?: Record<string, any>;
}

/**
 * A single streaming chunk
 */
export interface StreamChunk {
  /** Text delta for this chunk */
  delta: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Provider that served the stream */
  provider: string;
  /** Model used */
  model: string;
}

/**
 * Per-provider configuration
 */
export interface ProviderConfig {
  apiKey?: string;
  /** Override base URL (useful for proxies / local models) */
  baseUrl?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Default model to use for this provider */
  defaultModel?: string;
}

/**
 * Top-level Vyrion constructor config.
 * Keys are provider names; values are either an API key string or a full ProviderConfig.
 *
 * @example
 * new Vyrion({
 *   openai: "sk-...",
 *   groq: { apiKey: "gsk_...", timeout: 10000 },
 *   ollama: { baseUrl: "http://localhost:11434" }
 * })
 */
export interface VyrionConfig {
  openai?: string | ProviderConfig;
  groq?: string | ProviderConfig;
  gemini?: string | ProviderConfig;
  anthropic?: string | ProviderConfig;
  mistral?: string | ProviderConfig;
  together?: string | ProviderConfig;
  ollama?: string | ProviderConfig;
  /** Global request timeout override in ms */
  timeout?: number;
  /** Default fallback chain (provider names in priority order) */
  fallback?: string[];
  /** Default routing goal */
  defaultGoal?: RoutingGoal;
  /** Caching configuration (boolean to use in-memory cache or a custom ICache instance) */
  cache?: boolean | ICache;
  /** Global middleware array to intercept requests/responses */
  middleware?: Middleware[];
  /** Circuit Breaker and cooldown configurations */
  circuitBreaker?: CircuitBreakerConfig;
  [key: string]: unknown;
}

export interface CircuitBreakerConfig {
  failuresThreshold?: number;
  cooldownMs?: number;
}

/** Provider health status */
export type HealthStatus = "up" | "degraded" | "down" | "unknown";

/** Result of a health check */
export interface HealthCheckResult {
  provider: string;
  status: HealthStatus;
  latency?: number;
  error?: string;
  checkedAt: Date;
}

/** Per-provider analytics snapshot */
export interface ProviderStats {
  provider: string;
  requests: number;
  errors: number;
  totalTokens: number;
  totalCost: number;
  totalLatency: number;
  avgLatency: number;
  errorRate: number;
}

/** Overall analytics snapshot */
export interface AnalyticsSnapshot {
  totalRequests: number;
  totalErrors: number;
  totalTokens: number;
  totalCost: number;
  providers: ProviderStats[];
  since: Date;
}

/** Pricing entry for a model */
export interface ModelPricing {
  /** Cost per 1M input/prompt tokens in USD */
  inputPer1M: number;
  /** Cost per 1M output/completion tokens in USD */
  outputPer1M: number;
}
