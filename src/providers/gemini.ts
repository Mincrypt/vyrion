import { BaseProvider } from "./base.js";
import type { ChatRequest, ChatResponse, StreamChunk, HealthCheckResult, TokenUsage, MessageContentPart } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Google Gemini Provider Adapter
// ─────────────────────────────────────────────────────────────

export class GeminiProvider extends BaseProvider {
  readonly name = "gemini";
  readonly defaultModel = "gemini-2.5-flash";
  readonly supportedModels = [
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-pro-preview-06-05",
    "gemini-2.5-flash-preview-05-20",
    "gemini-2.0-pro-exp-02-05",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _client: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (!this._client) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { GoogleGenAI } = await import("@google/genai" as string) as any;
      this._client = new GoogleGenAI({ apiKey: this.config.apiKey });
    }
    return this._client;
  }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    const client = await this.getClient();
    const model = this.resolveModel(req);
    const start = Date.now();

    // Build prompt — Gemini uses a single contents array
    const contents = this.buildGeminiContents(req);

    const tools = req.tools ? [{
      functionDeclarations: req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      }))
    }] : undefined;

    let responseMimeType: string | undefined;
    let responseSchema: any = undefined;
    if (req.responseFormat) {
      responseMimeType = "application/json";
      if (typeof req.responseFormat !== "string" && req.responseFormat.type === "json_schema") {
        responseSchema = req.responseFormat.schema;
      }
    }

    const result = await client.models.generateContent({
      model,
      contents,
      config: {
        maxOutputTokens: req.maxTokens,
        temperature: req.temperature,
        systemInstruction: req.systemPrompt,
        tools,
        responseMimeType,
        responseSchema,
      },
    });

    const latency = Date.now() - start;
    const text = result.text ?? "";
    const usage: TokenUsage = {
      prompt: result.usageMetadata?.promptTokenCount ?? 0,
      completion: result.usageMetadata?.candidatesTokenCount ?? 0,
      total: result.usageMetadata?.totalTokenCount ?? 0,
    };

    const gcalls = result.functionCalls || [];
    const toolCalls = gcalls.length > 0 ? gcalls.map((fc: any, index: number) => ({
      id: `call_${fc.name}_${index}`,
      type: "function" as const,
      function: {
        name: fc.name,
        arguments: JSON.stringify(fc.args),
      }
    })) : undefined;

    let json: Record<string, any> | undefined;
    if (req.responseFormat && text) {
      try {
        json = JSON.parse(text);
      } catch {
        // Ignore json parse error
      }
    }

    return {
      content: text,
      provider: this.name,
      model,
      usage,
      latency,
      cost: 0,
      finishReason: result.candidates?.[0]?.finishReason ?? "STOP",
      toolCalls,
      json,
    };
  }

  async *stream(req: ChatRequest): AsyncGenerator<StreamChunk> {
    const client = await this.getClient();
    const model = this.resolveModel(req);
    const contents = this.buildGeminiContents(req);

    const streamResult = await client.models.generateContentStream({
      model,
      contents,
      config: {
        maxOutputTokens: req.maxTokens,
        temperature: req.temperature,
        systemInstruction: req.systemPrompt,
      },
    });

    for await (const chunk of streamResult) {
      const delta = chunk.text ?? "";
      const done = chunk.candidates?.[0]?.finishReason != null && chunk.candidates[0].finishReason !== "FINISH_REASON_UNSPECIFIED";
      yield { delta, done, provider: this.name, model };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const client = await this.getClient();
      const modelToCheck = this.config.defaultModel || this.defaultModel;
      await client.models.get({ model: modelToCheck });
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

  private buildGeminiContents(req: ChatRequest): any[] {
    if (req.messages && req.messages.length > 0) {
      // Filter out system messages (handled via systemInstruction config)
      return req.messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          let parts: any[] = [];
          if (typeof m.content === "string") {
            parts = [{ text: m.content }];
          } else if (Array.isArray(m.content)) {
            parts = m.content.map(mapGeminiContentPart);
          }
          return {
            role: m.role === "assistant" ? "model" : "user",
            parts,
          };
        });
    }
    return [{ role: "user", parts: [{ text: req.message ?? "" }] }];
  }
}

function mapGeminiContentPart(part: MessageContentPart): any {
  if (part.type === "text") {
    return { text: part.text ?? "" };
  }
  if (part.type === "image") {
    let data = part.image?.url ?? "";
    let mimeType = part.image?.mimeType ?? "image/jpeg";
    if (data.includes(";base64,")) {
      const parts = data.split(";base64,");
      mimeType = parts[0]?.split(":")[1] || mimeType;
      data = parts[1] || "";
    }
    return {
      inlineData: {
        mimeType,
        data,
      },
    };
  }
  if (part.type === "file") {
    let data = part.file?.url ?? "";
    let mimeType = part.file?.mimeType ?? "application/pdf";
    if (data.includes(";base64,")) {
      const parts = data.split(";base64,");
      mimeType = parts[0]?.split(":")[1] || mimeType;
      data = parts[1] || "";
    }
    return {
      inlineData: {
        mimeType,
        data,
      },
    };
  }
  return part;
}
