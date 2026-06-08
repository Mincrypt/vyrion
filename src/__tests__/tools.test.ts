import { describe, it, expect, vi, beforeEach } from "vitest";
import Vyrion from "../index.js";
import type { ChatRequest } from "../types/index.js";

// Mock openai
// @ts-ignore
vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async (params) => {
            if (params.tools) {
              return {
                choices: [
                  {
                    message: {
                      content: null,
                      tool_calls: [
                        {
                          id: "call-123",
                          type: "function",
                          function: {
                            name: "getWeather",
                            arguments: '{"location":"New York"}',
                          },
                        },
                      ],
                    },
                    finish_reason: "tool_calls",
                  },
                ],
                usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
                model: "gpt-4o-mini",
              };
            }
            if (params.response_format) {
              return {
                choices: [
                  {
                    message: {
                      content: '{"answer": 42}',
                    },
                    finish_reason: "stop",
                  },
                ],
                usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
                model: "gpt-4o-mini",
              };
            }
            return {
              choices: [{ message: { content: "Hello" }, finish_reason: "stop" }],
              usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
              model: "gpt-4o-mini",
            };
          }),
        },
      },
      models: { list: vi.fn().mockResolvedValue({ data: [] }) },
    })),
  };
});

// Mock @google/genai
// @ts-ignore
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn().mockImplementation(async (params) => {
          if (params.config?.tools) {
            return {
              text: "",
              functionCalls: [
                {
                  name: "getWeather",
                  args: { location: "New York" },
                },
              ],
              usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
              candidates: [{ finishReason: "STOP" }],
            };
          }
          if (params.config?.responseMimeType) {
            return {
              text: '{"answer": 42}',
              usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
              candidates: [{ finishReason: "STOP" }],
            };
          }
          return {
            text: "Hello",
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
            candidates: [{ finishReason: "STOP" }],
          };
        }),
      },
    })),
  };
});

// Mock @anthropic-ai/sdk
// @ts-ignore
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockImplementation(async (params) => {
          if (params.tools) {
            return {
              content: [
                {
                  type: "tool_use",
                  id: "call-456",
                  name: "getWeather",
                  input: { location: "New York" },
                },
              ],
              usage: { input_tokens: 10, output_tokens: 20 },
              stop_reason: "tool_use",
            };
          }
          if (params.system && params.system.includes("JSON")) {
            return {
              content: [{ type: "text", text: '{"answer": 42}' }],
              usage: { input_tokens: 10, output_tokens: 20 },
              stop_reason: "end_turn",
            };
          }
          return {
            content: [{ type: "text", text: "Hello" }],
            usage: { input_tokens: 10, output_tokens: 20 },
            stop_reason: "end_turn",
          };
        }),
      },
    })),
  };
});

describe("Vyrion Unified Tool Calling & Structured Outputs", () => {
  it("should map and parse tool calls for OpenAI", async () => {
    const ai = new Vyrion({ openai: "sk-test" });
    const res = await ai.chat({
      message: "What is the weather?",
      provider: "openai",
      tools: [
        {
          name: "getWeather",
          description: "Get weather details",
          parameters: {
            type: "object",
            properties: { location: { type: "string" } },
          },
        },
      ],
    });

    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls?.[0].function.name).toBe("getWeather");
    expect(JSON.parse(res.toolCalls?.[0]?.function.arguments || "{}")).toEqual({ location: "New York" });
  });

  it("should parse structured JSON output for OpenAI", async () => {
    const ai = new Vyrion({ openai: "sk-test" });
    const res = await ai.chat({
      message: "Give me the answer",
      provider: "openai",
      responseFormat: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: { answer: { type: "number" } },
        },
      },
    });

    expect(res.json).toEqual({ answer: 42 });
  });

  it("should map and parse tool calls for Gemini", async () => {
    const ai = new Vyrion({ gemini: "AIza-test" });
    const res = await ai.chat({
      message: "What is the weather?",
      provider: "gemini",
      tools: [
        {
          name: "getWeather",
          description: "Get weather details",
          parameters: {
            type: "object",
            properties: { location: { type: "string" } },
          },
        },
      ],
    });

    expect(res.toolCalls).toBeDefined();
    expect(res.toolCalls?.[0].function.name).toBe("getWeather");
    expect(JSON.parse(res.toolCalls?.[0]?.function.arguments || "{}")).toEqual({ location: "New York" });
  });

  it("should parse structured JSON output for Gemini", async () => {
    const ai = new Vyrion({ gemini: "AIza-test" });
    const res = await ai.chat({
      message: "Give me the answer",
      provider: "gemini",
      responseFormat: "json",
    });

    expect(res.json).toEqual({ answer: 42 });
  });

  it("should map and parse tool calls for Anthropic", async () => {
    const ai = new Vyrion({ anthropic: "sk-ant-test" });
    const res = await ai.chat({
      message: "What is the weather?",
      provider: "anthropic",
      tools: [
        {
          name: "getWeather",
          description: "Get weather details",
          parameters: {
            type: "object",
            properties: { location: { type: "string" } },
          },
        },
      ],
    });

    expect(res.toolCalls).toHaveLength(1);
    expect(res.toolCalls?.[0].function.name).toBe("getWeather");
    expect(JSON.parse(res.toolCalls?.[0]?.function.arguments || "{}")).toEqual({ location: "New York" });
  });

  it("should parse structured JSON output for Anthropic", async () => {
    const ai = new Vyrion({ anthropic: "sk-ant-test" });
    const res = await ai.chat({
      message: "Give me the answer",
      provider: "anthropic",
      responseFormat: "json",
    });

    expect(res.json).toEqual({ answer: 42 });
  });

  it("should support tool calling and structured output optionally on custom providers", async () => {
    const ai = new Vyrion({ openai: "sk-test" });
    ai.registerProvider({
      name: "my-custom-tool-provider",
      defaultModel: "model-x",
      isAvailable: () => true,
      chat: async (req: ChatRequest) => {
        // Echo back tools received
        return {
          content: `Tools received: ${req.tools?.length || 0}`,
          provider: "my-custom-tool-provider",
          model: "model-x",
          usage: { prompt: 1, completion: 1, total: 2 },
          latency: 10,
          cost: 0,
          finishReason: "stop",
        };
      },
      stream: async function* (req: ChatRequest) {
        yield { delta: "", done: true, provider: "my-custom-tool-provider", model: "model-x" };
      },
      healthCheck: async () => ({ provider: "my-custom-tool-provider", status: "up", checkedAt: new Date() }),
    });

    const res = await ai.chat({
      message: "Hello",
      provider: "my-custom-tool-provider",
      tools: [
        {
          name: "test-tool",
        },
      ],
    });

    expect(res.content).toBe("Tools received: 1");
  });
});
