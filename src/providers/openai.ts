import { BaseProvider } from "./base.js";
import type { ChatRequest, ChatResponse, StreamChunk, HealthCheckResult, TokenUsage } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  OpenAI Provider Adapter
// ─────────────────────────────────────────────────────────────

export class OpenAIProvider extends BaseProvider {
  readonly name = "openai";
  readonly defaultModel = "gpt-4o-mini";
  readonly supportedModels = [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4",
    "gpt-3.5-turbo",
    "o1",
    "o1-mini",
    "o3-mini",
  ];

  // Lazy-loaded to avoid hard dependency at import time
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _client: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (!this._client) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { default: OpenAI } = await import("openai" as string) as any;
      this._client = new OpenAI({
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
    const messages = this.buildMessages(req).map((m) => ({
      role: m.role,
      content: mapOpenAIMessageContent(m.content),
    }));
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
      cost: 0, // filled by cost module
      finishReason: choice?.finish_reason ?? "stop",
      toolCalls,
      json,
    };
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    const client = await this.getClient();
    const model = this.resolveModel(req);
    const messages = this.buildMessages(req).map((m) => ({
      role: m.role,
      content: mapOpenAIMessageContent(m.content),
    }));

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

// ── Helpers ─────────────────────────────────────────────

function mapOpenAIMessageContent(content: string | MessageContentPart[]): any {
  if (typeof content === "string") return content;
  return content.map((part) => {
    if (part.type === "text") {
      return { type: "text", text: part.text ?? "" };
    }
    if (part.type === "image") {
      return {
        type: "image_url",
        image_url: {
          url: part.image?.url ?? "",
        },
      };
    }
    if (part.type === "file") {
      const mime = part.file?.mimeType ?? "";
      if (mime.startsWith("text/") || mime === "application/json" || mime === "text/csv") {
        let textVal = part.file?.url ?? "";
        if (textVal.includes(";base64,")) {
          const base64Data = textVal.split(";base64,")[1];
          if (base64Data) {
            textVal = Buffer.from(base64Data, "base64").toString("utf8");
          }
        } else if (!textVal.startsWith("http")) {
          try {
            textVal = Buffer.from(textVal, "base64").toString("utf8");
          } catch {
            // fallback
          }
        }
        return { type: "text", text: textVal };
      }
      throw new Error(`OpenAI does not natively support "${mime}" file attachments. Please use Gemini or Anthropic instead.`);
    }
    return part;
  });
}
