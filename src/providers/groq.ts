import { BaseProvider } from "./base.js";
import type { ChatRequest, ChatResponse, StreamChunk, HealthCheckResult, TokenUsage } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Groq Provider Adapter
// ─────────────────────────────────────────────────────────────

export class GroqProvider extends BaseProvider {
  readonly name = "groq";
  readonly defaultModel = "llama-3.1-8b-instant";
  readonly supportedModels = [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    "gemma2-9b-it",
    "gemma-7b-it",
    "whisper-large-v3",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _client: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (!this._client) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { default: Groq } = await import("groq-sdk" as string) as any;
      this._client = new Groq({
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
    const messages = this.buildMessages(req);
    const start = Date.now();

    const tools = req.tools?.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    let response_format: any;
    if (req.responseFormat) {
      if (req.responseFormat === "json") {
        response_format = { type: "json_object" };
      } else if (req.responseFormat.type === "json_object") {
        response_format = { type: "json_object" };
      } else if (req.responseFormat.type === "json_schema") {
        response_format = {
          type: "json_schema",
          json_schema: {
            name: "response_schema",
            schema: req.responseFormat.schema,
            strict: true,
          },
        };
      }
    }

    const completion = await client.chat.completions.create({
      model,
      messages,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      tools: tools && tools.length > 0 ? tools : undefined,
      response_format,
    });

    const latency = Date.now() - start;
    const choice = completion.choices[0];
    const usage: TokenUsage = {
      prompt: completion.usage?.prompt_tokens ?? 0,
      completion: completion.usage?.completion_tokens ?? 0,
      total: completion.usage?.total_tokens ?? 0,
    };

    const toolCalls = choice?.message?.tool_calls?.map((tc: any) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    let json: Record<string, any> | undefined;
    if (req.responseFormat && choice?.message?.content) {
      try {
        json = JSON.parse(choice.message.content);
      } catch {
        // Ignore json parse error
      }
    }

    return {
      content: choice?.message?.content ?? "",
      provider: this.name,
      model,
      usage,
      latency,
      cost: 0,
      finishReason: choice?.finish_reason ?? "stop",
      toolCalls,
      json,
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
