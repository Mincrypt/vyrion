import { BaseProvider } from "./base.js";
import type { ChatRequest, ChatResponse, StreamChunk, HealthCheckResult, TokenUsage } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Together AI Provider Adapter
//  Together AI exposes an OpenAI-compatible API — we reuse
//  the openai SDK pointed at Together's base URL.
// ─────────────────────────────────────────────────────────────

const TOGETHER_BASE_URL = "https://api.together.xyz/v1";

export class TogetherProvider extends BaseProvider {
  readonly name = "together";
  readonly defaultModel = "meta-llama/Llama-3-8b-chat-hf";
  readonly supportedModels = [
    "meta-llama/Llama-3-70b-chat-hf",
    "meta-llama/Llama-3-8b-chat-hf",
    "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
    "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    "mistralai/Mixtral-8x7B-Instruct-v0.1",
    "mistralai/Mistral-7B-Instruct-v0.3",
    "Qwen/Qwen2-72B-Instruct",
    "deepseek-ai/deepseek-coder-33b-instruct",
    "google/gemma-2-27b-it",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _client: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (!this._client) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { default: OpenAI } = await import("openai" as string) as any;
      this._client = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl ?? TOGETHER_BASE_URL,
        timeout: this.config.timeout ?? 30_000,
      });
    }
    return this._client;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const client = await this.getClient();
    const model = this.resolveModel(req);
    const messages = this.buildMessages(req);
    const start = Date.now();

    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
    });

    const latency = Date.now() - start;
    const choice = completion.choices[0];
    const usage: TokenUsage = {
      prompt: completion.usage?.prompt_tokens ?? 0,
      completion: completion.usage?.completion_tokens ?? 0,
      total: completion.usage?.total_tokens ?? 0,
    };

    return {
      content: choice?.message?.content ?? "",
      provider: this.name,
      model,
      usage,
      latency,
      cost: 0,
      finishReason: choice?.finish_reason ?? "stop",
    };
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    const client = await this.getClient();
    const model = this.resolveModel(req);
    const messages = this.buildMessages(req);

    const stream = await client.chat.completions.create({
      model,
      messages,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      const done = chunk.choices[0]?.finish_reason != null;
      yield { delta, done, provider: this.name, model };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const client = await this.getClient();
      await client.models.list();
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
