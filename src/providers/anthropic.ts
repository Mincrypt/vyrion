import { BaseProvider } from "./base.js";
import type { ChatRequest, ChatResponse, StreamChunk, HealthCheckResult, TokenUsage } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Anthropic Provider Adapter
// ─────────────────────────────────────────────────────────────

export class AnthropicProvider extends BaseProvider {
  readonly name = "anthropic";
  readonly defaultModel = "claude-3-5-haiku-latest";
  readonly supportedModels = [
    "claude-opus-4-5",
    "claude-sonnet-4-5",
    "claude-haiku-4-5",
    "claude-3-7-sonnet-latest",
    "claude-3-5-sonnet-latest",
    "claude-3-5-haiku-latest",
    "claude-3-opus-latest",
    "claude-3-haiku-20240307",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _client: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (!this._client) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { default: Anthropic } = await import("@anthropic-ai/sdk" as string) as any;
      this._client = new Anthropic({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
        timeout: this.config.timeout ?? 30_000,
      });
    }
    return this._client;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const client = await this.getClient();
    const model = this.resolveModel(req);
    const { messages, system } = this.buildAnthropicMessages(req);
    const start = Date.now();

    const response = await client.messages.create({
      model,
      max_tokens: req.maxTokens ?? 4096,
      messages,
      system,
      temperature: req.temperature,
    });

    const latency = Date.now() - start;
    const content = response.content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((b: any) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => b.text as string)
      .join("");

    const usage: TokenUsage = {
      prompt: response.usage.input_tokens,
      completion: response.usage.output_tokens,
      total: response.usage.input_tokens + response.usage.output_tokens,
    };

    return {
      content,
      provider: this.name,
      model,
      usage,
      latency,
      cost: 0,
      finishReason: response.stop_reason ?? "end_turn",
    };
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    const client = await this.getClient();
    const model = this.resolveModel(req);
    const { messages, system } = this.buildAnthropicMessages(req);

    const stream = await client.messages.create({
      model,
      max_tokens: req.maxTokens ?? 4096,
      messages,
      system,
      temperature: req.temperature,
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { delta: event.delta.text, done: false, provider: this.name, model };
      } else if (event.type === "message_stop") {
        yield { delta: "", done: true, provider: this.name, model };
      }
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const client = await this.getClient();
      const modelToCheck = this.config.defaultModel || this.defaultModel;
      // Minimal 1-token request to validate key
      await client.messages.create({
        model: modelToCheck,
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
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

  // ── Helpers ─────────────────────────────────────────────

  private buildAnthropicMessages(req: ChatRequest): {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    system: string | undefined;
  } {
    let system: string | undefined = req.systemPrompt;

    if (req.messages && req.messages.length > 0) {
      const filtered = req.messages.filter((m) => {
        if (m.role === "system") { system = m.content; return false; }
        return true;
      });
      return {
        messages: filtered.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        system,
      };
    }

    return {
      messages: [{ role: "user", content: req.message ?? "" }],
      system,
    };
  }
}
