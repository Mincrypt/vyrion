import { BaseProvider } from "./base.js";
import type { ChatRequest, ChatResponse, StreamChunk, HealthCheckResult, TokenUsage, MessageContentPart } from "../types/index.js";

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
    let { messages, system } = this.buildAnthropicMessages(req);
    const start = Date.now();

    const tools = req.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters || { type: "object", properties: {} },
    }));

    if (req.responseFormat) {
      const jsonInstruction = "IMPORTANT: You must respond ONLY with a valid JSON object.";
      system = system ? `${system}\n\n${jsonInstruction}` : jsonInstruction;
    }

    const response = await client.messages.create({
      model,
      max_tokens: req.maxTokens ?? 4096,
      messages,
      system,
      temperature: req.temperature,
      tools: tools && tools.length > 0 ? tools : undefined,
    });

    const latency = Date.now() - start;
    const content = response.content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((b: any) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => b.text as string)
      .join("");

    const toolCalls = response.content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((b: any) => b.type === "tool_use")
      .map((b: any) => ({
        id: b.id,
        type: "function" as const,
        function: {
          name: b.name,
          arguments: JSON.stringify(b.input),
        },
      }));

    const usage: TokenUsage = {
      prompt: response.usage.input_tokens,
      completion: response.usage.output_tokens,
      total: response.usage.input_tokens + response.usage.output_tokens,
    };

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
      finishReason: response.stop_reason ?? "end_turn",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      json,
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
    messages: Array<{ role: "user" | "assistant"; content: string | any[] }>;
    system: string | undefined;
  } {
    let system: string | undefined = req.systemPrompt;

    if (req.messages && req.messages.length > 0) {
      const filtered = req.messages.filter((m) => {
        if (m.role === "system") {
          system = typeof m.content === "string"
            ? m.content
            : m.content.map((p) => p.text || "").join("\n");
          return false;
        }
        return true;
      });
      return {
        messages: filtered.map((m) => {
          let content: string | any[] = m.content;
          if (Array.isArray(m.content)) {
            content = m.content.map(mapAnthropicContentPart);
          }
          return {
            role: m.role as "user" | "assistant",
            content,
          };
        }),
        system,
      };
    }

    return {
      messages: [{ role: "user", content: req.message ?? "" }],
      system,
    };
  }
}

function mapAnthropicContentPart(part: MessageContentPart): any {
  if (part.type === "text") {
    return { type: "text", text: part.text ?? "" };
  }
  if (part.type === "image") {
    let data = part.image?.url ?? "";
    let mediaType = part.image?.mimeType ?? "image/jpeg";
    if (data.includes(";base64,")) {
      const parts = data.split(";base64,");
      mediaType = parts[0]?.split(":")[1] || mediaType;
      data = parts[1] || "";
    }
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data,
      },
    };
  }
  if (part.type === "file") {
    let data = part.file?.url ?? "";
    let mediaType = part.file?.mimeType ?? "application/pdf";
    if (data.includes(";base64,")) {
      const parts = data.split(";base64,");
      mediaType = parts[0]?.split(":")[1] || mediaType;
      data = parts[1] || "";
    }

    if (mediaType === "application/pdf") {
      return {
        type: "document",
        source: {
          type: "base64",
          media_type: mediaType,
          data,
        },
      };
    }
    if (mediaType.startsWith("text/") || mediaType === "application/json" || mediaType === "text/csv") {
      try {
        const textVal = Buffer.from(data, "base64").toString("utf8");
        return { type: "text", text: textVal };
      } catch {
        // fallback
      }
    }
    throw new Error(`Anthropic does not support "${mediaType}" document format. Only PDF and text files are supported.`);
  }
  return part;
}
