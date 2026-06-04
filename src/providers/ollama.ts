import { BaseProvider } from "./base.js";
import type { ChatRequest, ChatResponse, StreamChunk, HealthCheckResult, TokenUsage } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Ollama Provider Adapter
//  Ollama exposes an OpenAI-compatible API at localhost:11434.
//  We use native fetch to avoid any SDK dependency.
// ─────────────────────────────────────────────────────────────

const DEFAULT_OLLAMA_BASE = "http://localhost:11434";

interface OllamaMessage {
  role: string;
  content: string;
}

interface OllamaResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaStreamChunk {
  model: string;
  message: { role: string; content: string };
  done: boolean;
}

export class OllamaProvider extends BaseProvider {
  readonly name = "ollama";
  readonly defaultModel = "llama3.2";
  readonly supportedModels = [
    "llama3.2",
    "llama3.2:1b",
    "llama3.1",
    "llama3.1:70b",
    "phi4",
    "phi3",
    "mistral",
    "mistral-nemo",
    "gemma3",
    "qwen2.5",
    "deepseek-r1",
    "codellama",
    "nomic-embed-text",
  ];

  private get baseUrl(): string {
    return (this.config.baseUrl ?? DEFAULT_OLLAMA_BASE).replace(/\/$/, "");
  }

  /** Ollama is available if we can reach the base URL (no API key needed) */
  override isAvailable(): boolean {
    return true; // Always attempt; health check will determine actual status
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const model = this.resolveModel(req);
    const messages = this.buildMessages(req) as OllamaMessage[];
    const start = Date.now();

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          num_predict: req.maxTokens,
          temperature: req.temperature,
        },
      }),
      signal: req.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as OllamaResponse;
    const latency = Date.now() - start;
    const promptTokens = data.prompt_eval_count ?? 0;
    const completionTokens = data.eval_count ?? 0;

    const usage: TokenUsage = {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    };

    return {
      content: data.message.content,
      provider: this.name,
      model,
      usage,
      latency,
      cost: 0, // Local model — no cost
      finishReason: data.done ? "stop" : "length",
    };
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    const model = this.resolveModel(req);
    const messages = this.buildMessages(req) as OllamaMessage[];

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: {
          num_predict: req.maxTokens,
          temperature: req.temperature,
        },
      }),
      signal: req.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama stream error ${response.status}: ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done: readDone, value } = await reader.read();
      if (readDone) break;

      const lines = decoder.decode(value, { stream: true }).split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const chunk = JSON.parse(line) as OllamaStreamChunk;
          yield {
            delta: chunk.message?.content ?? "",
            done: chunk.done,
            provider: this.name,
            model,
          };
        } catch {
          // Skip malformed lines
        }
      }
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return {
        provider: this.name,
        status: "up",
        latency: Date.now() - start,
        checkedAt: new Date(),
      };
    } catch (err) {
      return this.failedHealth(err);
    }
  }
}
