import { BaseProvider } from "./base.js";
import type { ChatRequest, ChatResponse, StreamChunk, HealthCheckResult, TokenUsage } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Google Gemini Provider Adapter
// ─────────────────────────────────────────────────────────────

export class GeminiProvider extends BaseProvider {
  readonly name = "gemini";
  readonly defaultModel = "gemini-2.0-flash";
  readonly supportedModels = [
    "gemini-2.5-pro-preview-06-05",
    "gemini-2.5-flash-preview-05-20",
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

    const result = await client.models.generateContent({
      model,
      contents,
      config: {
        maxOutputTokens: req.maxTokens,
        temperature: req.temperature,
        systemInstruction: req.systemPrompt,
      },
    });

    const latency = Date.now() - start;
    const text = result.text ?? "";
    const usage: TokenUsage = {
      prompt: result.usageMetadata?.promptTokenCount ?? 0,
      completion: result.usageMetadata?.candidatesTokenCount ?? 0,
      total: result.usageMetadata?.totalTokenCount ?? 0,
    };

    return {
      content: text,
      provider: this.name,
      model,
      usage,
      latency,
      cost: 0,
      finishReason: result.candidates?.[0]?.finishReason ?? "STOP",
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
      await client.models.get({ model: "gemini-2.0-flash" });
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

  private buildGeminiContents(req: ChatRequest): Array<{ role: string; parts: Array<{ text: string }> }> {
    if (req.messages && req.messages.length > 0) {
      // Filter out system messages (handled via systemInstruction config)
      return req.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
    }
    return [{ role: "user", parts: [{ text: req.message ?? "" }] }];
  }
}
