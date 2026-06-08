import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  HealthCheckResult,
  ProviderConfig,
  MessageContentPart,
} from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  IProvider — contract every provider adapter must fulfil
// ─────────────────────────────────────────────────────────────

export interface IProvider {
  /** Canonical name used as the key in config and routing */
  readonly name: string;
  /** Default model used when none is specified in the request */
  readonly defaultModel: string;
  /** All models this provider supports (for health-check probing) */
  readonly supportedModels: string[];
  /** Whether this provider was configured and can accept requests */
  isAvailable(): boolean;
  /** Send a chat request and return a normalised response */
  chat(req: ChatRequest): Promise<ChatResponse>;
  /** Stream a chat response as an async generator of chunks */
  stream(req: ChatRequest): AsyncGenerator<StreamChunk>;
  /** Probe the provider and return its current health */
  healthCheck(): Promise<HealthCheckResult>;
}

// ─────────────────────────────────────────────────────────────
//  BaseProvider — shared helpers for concrete implementations
// ─────────────────────────────────────────────────────────────

export abstract class BaseProvider implements IProvider {
  abstract readonly name: string;
  abstract readonly defaultModel: string;
  abstract readonly supportedModels: string[];

  protected readonly config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  isAvailable(): boolean {
    return Boolean(this.config.apiKey || this.config.baseUrl);
  }

  abstract chat(req: ChatRequest): Promise<ChatResponse>;
  abstract stream(req: ChatRequest): AsyncGenerator<StreamChunk>;
  abstract healthCheck(): Promise<HealthCheckResult>;

  // ── Utilities ────────────────────────────────────────────

  /** Build a normalised message array from a ChatRequest */
  protected buildMessages(
    req: ChatRequest
  ): Array<{ role: string; content: string | MessageContentPart[] }> {
    if (req.messages && req.messages.length > 0) {
      return req.messages;
    }
    const msgs: Array<{ role: string; content: string | MessageContentPart[] }> = [];
    if (req.systemPrompt) {
      msgs.push({ role: "system", content: req.systemPrompt });
    }
    if (req.message) {
      msgs.push({ role: "user", content: req.message });
    }
    return msgs;
  }

  /** Resolve the model to use for this request */
  protected resolveModel(req: ChatRequest): string {
    return req.model ?? this.config.defaultModel ?? this.defaultModel;
  }

  /** Return a health-check failure result */
  protected failedHealth(error: unknown): HealthCheckResult {
    return {
      provider: this.name,
      status: "down",
      error: error instanceof Error ? error.message : String(error),
      checkedAt: new Date(),
    };
  }
}
