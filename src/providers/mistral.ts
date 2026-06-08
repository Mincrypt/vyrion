import { BaseProvider } from "./base.js";
import type { ChatRequest, ChatResponse, StreamChunk, HealthCheckResult, TokenUsage } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Mistral Provider Adapter
// ─────────────────────────────────────────────────────────────

export class MistralProvider extends BaseProvider {
  readonly name = "mistral";
  readonly defaultModel = "mistral-small-latest";
  readonly supportedModels = [
    "mistral-large-latest",
    "mistral-medium-latest",
    "mistral-small-latest",
    "mistral-tiny",
    "codestral-latest",
    "mistral-embed",
    "open-mistral-nemo",
    "open-mixtral-8x22b",
    "open-mixtral-8x7b",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _client: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (!this._client) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { Mistral } = await import("@mistralai/mistralai" as string) as any;
      this._client = new Mistral({
        apiKey: this.config.apiKey,
        serverURL: this.config.baseUrl,
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

    let responseFormat: any;
    if (req.responseFormat) {
      if (req.responseFormat === "json" || req.responseFormat.type === "json_object") {
        responseFormat = { type: "json_object" };
      } else if (req.responseFormat.type === "json_schema") {
        responseFormat = { type: "json_object" };
      }
    }

    const response = await client.chat.complete({
      model,
      messages,
      maxTokens: req.maxTokens,
      temperature: req.temperature,
      tools: tools && tools.length > 0 ? tools : undefined,
      responseFormat,
    });

    const latency = Date.now() - start;
    const choice = response.choices?.[0];
    const msgContent = choice?.message?.content;
    const content = typeof msgContent === "string" ? msgContent : (msgContent ?? []).toString();

    const usage: TokenUsage = {
      prompt: response.usage?.promptTokens ?? 0,
      completion: response.usage?.completionTokens ?? 0,
      total: response.usage?.totalTokens ?? 0,
    };

    const mCalls = choice?.message?.toolCalls || choice?.message?.tool_calls || [];
    const toolCalls = mCalls.length > 0 ? mCalls.map((tc: any) => ({
      id: tc.id,
      type: "function" as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    })) : undefined;

    let json: Record<string, any> | undefined;
    if (req.responseFormat && content) {
      try {
        json = JSON.parse(content);
      } catch {
        // Ignore json parse error
      }
    }

    return {
      content,
      provider: this.name,
      model,
      usage,
      latency,
      cost: 0,
      finishReason: choice?.finishReason ?? "stop",
      toolCalls,
      json,
    };
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    const client = await this.getClient();
    const model = this.resolveModel(req);
    const messages = this.buildMessages(req);

    const stream = await client.chat.stream({
      model,
      messages,
      maxTokens: req.maxTokens,
      temperature: req.temperature,
    });

    for await (const chunk of stream) {
      const delta = chunk.data.choices?.[0]?.delta?.content ?? "";
      const done = chunk.data.choices?.[0]?.finishReason != null;
      yield { delta: typeof delta === "string" ? delta : "", done, provider: this.name, model };
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
