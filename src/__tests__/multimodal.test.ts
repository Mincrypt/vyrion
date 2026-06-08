import { describe, it, expect, vi } from "vitest";
import Vyrion from "../index.js";

const mockOpenAICreate = vi.fn().mockResolvedValue({
  choices: [{ message: { content: "Mocked OpenAI response" }, finish_reason: "stop" }],
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  model: "gpt-4o-mini",
});

// @ts-ignore
vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockOpenAICreate,
        },
      },
      models: { list: vi.fn().mockResolvedValue({ data: [] }) },
    })),
  };
});

const mockGeminiGenerateContent = vi.fn().mockResolvedValue({
  text: "Mocked Gemini response",
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 },
  candidates: [{ finishReason: "STOP" }],
});

// @ts-ignore
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: mockGeminiGenerateContent,
      },
    })),
  };
});

const mockAnthropicCreate = vi.fn().mockResolvedValue({
  content: [{ type: "text", text: "Mocked Anthropic response" }],
  usage: { input_tokens: 10, output_tokens: 20 },
  stop_reason: "end_turn",
});

// @ts-ignore
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockAnthropicCreate,
      },
    })),
  };
});

describe("Vyrion Multimodal & File Support", () => {
  it("should map text and image parts to OpenAI's native format", async () => {
    const ai = new Vyrion({ openai: "sk-test" });
    await ai.chat({
      provider: "openai",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What is in this image?" },
            { type: "image", image: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIA..." } },
          ],
        },
      ],
    });

    expect(mockOpenAICreate).toHaveBeenCalled();
    const args = mockOpenAICreate.mock.calls[0][0];
    expect(args.messages[0].content).toEqual([
      { type: "text", text: "What is in this image?" },
      { type: "image_url", image_url: { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIA..." } },
    ]);
  });

  it("should decode text files inline for OpenAI", async () => {
    const ai = new Vyrion({ openai: "sk-test" });
    const fileBase64 = Buffer.from("hello text content").toString("base64");
    await ai.chat({
      provider: "openai",
      messages: [
        {
          role: "user",
          content: [
            { type: "file", file: { url: `data:text/plain;base64,${fileBase64}`, mimeType: "text/plain" } },
          ],
        },
      ],
    });

    const args = mockOpenAICreate.mock.calls[mockOpenAICreate.mock.calls.length - 1][0];
    expect(args.messages[0].content).toEqual([
      { type: "text", text: "hello text content" },
    ]);
  });

  it("should throw a descriptive error when sending binary PDF/document to OpenAI", async () => {
    const ai = new Vyrion({ openai: "sk-test" });
    await expect(
      ai.chat({
        provider: "openai",
        messages: [
          {
            role: "user",
            content: [
              { type: "file", file: { url: "data:application/pdf;base64,JVBERi0xLjQK...", mimeType: "application/pdf" } },
            ],
          },
        ],
      })
    ).rejects.toThrow(/OpenAI does not natively support/);
  });

  it("should map text, image and files correctly to Gemini's inlineData", async () => {
    const ai = new Vyrion({ gemini: "AIza-test" });
    await ai.chat({
      provider: "gemini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this image and document" },
            { type: "image", image: { url: "data:image/png;base64,imgdata...", mimeType: "image/png" } },
            { type: "file", file: { url: "data:application/pdf;base64,pdfdata...", mimeType: "application/pdf" } },
          ],
        },
      ],
    });

    expect(mockGeminiGenerateContent).toHaveBeenCalled();
    const args = mockGeminiGenerateContent.mock.calls[0][0];
    expect(args.contents[0].parts).toEqual([
      { text: "Analyze this image and document" },
      { inlineData: { mimeType: "image/png", data: "imgdata..." } },
      { inlineData: { mimeType: "application/pdf", data: "pdfdata..." } },
    ]);
  });

  it("should map image and PDF documents correctly to Anthropic's block format", async () => {
    const ai = new Vyrion({ anthropic: "sk-ant-test" });
    await ai.chat({
      provider: "anthropic",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "View image and doc" },
            { type: "image", image: { url: "data:image/png;base64,imgdata...", mimeType: "image/png" } },
            { type: "file", file: { url: "data:application/pdf;base64,pdfdata...", mimeType: "application/pdf" } },
          ],
        },
      ],
    });

    expect(mockAnthropicCreate).toHaveBeenCalled();
    const args = mockAnthropicCreate.mock.calls[0][0];
    expect(args.messages[0].content).toEqual([
      { type: "text", text: "View image and doc" },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: "imgdata...",
        },
      },
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: "pdfdata...",
        },
      },
    ]);
  });

  it("should throw error for unsupported document format in Anthropic", async () => {
    const ai = new Vyrion({ anthropic: "sk-ant-test" });
    await expect(
      ai.chat({
        provider: "anthropic",
        messages: [
          {
            role: "user",
            content: [
              { type: "file", file: { url: "data:application/zip;base64,...", mimeType: "application/zip" } },
            ],
          },
        ],
      })
    ).rejects.toThrow(/Anthropic does not support/);
  });
});
