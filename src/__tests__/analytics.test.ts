import { describe, it, expect, beforeEach } from "vitest";
import { AnalyticsTracker } from "../analytics/tracker.js";
import { estimateCost } from "../analytics/cost.js";
import type { TokenUsage } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Analytics Tracker Tests
// ─────────────────────────────────────────────────────────────

describe("AnalyticsTracker", () => {
  let tracker: AnalyticsTracker;

  beforeEach(() => {
    tracker = new AnalyticsTracker();
  });

  it("starts with empty snapshot", () => {
    const snap = tracker.getSnapshot();
    expect(snap.totalRequests).toBe(0);
    expect(snap.providers).toHaveLength(0);
  });

  it("records a successful event", () => {
    tracker.record({ provider: "openai", latency: 200, tokens: 100, cost: 0.001, success: true });
    const stats = tracker.getProviderStats("openai");
    expect(stats?.requests).toBe(1);
    expect(stats?.errors).toBe(0);
    expect(stats?.totalTokens).toBe(100);
    expect(stats?.avgLatency).toBe(200);
  });

  it("records an error event", () => {
    tracker.record({ provider: "openai", latency: 0, tokens: 0, cost: 0, success: false });
    const stats = tracker.getProviderStats("openai");
    expect(stats?.requests).toBe(1);
    expect(stats?.errors).toBe(1);
    expect(stats?.errorRate).toBe(1.0);
  });

  it("computes rolling average latency correctly", () => {
    tracker.record({ provider: "groq", latency: 100, tokens: 10, cost: 0, success: true });
    tracker.record({ provider: "groq", latency: 200, tokens: 10, cost: 0, success: true });
    tracker.record({ provider: "groq", latency: 300, tokens: 10, cost: 0, success: true });
    const stats = tracker.getProviderStats("groq");
    expect(stats?.avgLatency).toBe(200); // (100 + 200 + 300) / 3
  });

  it("tracks multiple providers independently", () => {
    tracker.record({ provider: "openai", latency: 500, tokens: 200, cost: 0.01, success: true });
    tracker.record({ provider: "groq", latency: 100, tokens: 50, cost: 0.001, success: true });

    const snap = tracker.getSnapshot();
    expect(snap.totalRequests).toBe(2);
    expect(snap.providers).toHaveLength(2);
    expect(snap.totalTokens).toBe(250);
  });

  it("resets all data", () => {
    tracker.record({ provider: "openai", latency: 100, tokens: 100, cost: 0, success: true });
    tracker.reset();
    expect(tracker.getSnapshot().totalRequests).toBe(0);
    expect(tracker.getProviderStats("openai")).toBeUndefined();
  });

  it("returns undefined for unknown provider stats", () => {
    expect(tracker.getProviderStats("nonexistent")).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
//  Cost Estimation Tests
// ─────────────────────────────────────────────────────────────

describe("estimateCost", () => {
  const usage: TokenUsage = { prompt: 1000, completion: 500, total: 1500 };

  it("estimates OpenAI GPT-4o cost correctly", () => {
    // gpt-4o: $2.50/1M in, $10.00/1M out
    // 1000 input = $0.0025, 500 output = $0.005 → total $0.0075
    const cost = estimateCost("openai", "gpt-4o", usage);
    expect(cost).toBeCloseTo(0.0075, 6);
  });

  it("estimates Groq Llama3-8b cost correctly", () => {
    // llama3-8b: $0.05/1M in, $0.08/1M out
    // 1000 in = $0.00005, 500 out = $0.00004 → $0.00009
    const cost = estimateCost("groq", "llama3-8b-8192", usage);
    expect(cost).toBeCloseTo(0.00009, 6);
  });

  it("returns 0 for Ollama (free local)", () => {
    const cost = estimateCost("ollama", "llama3.2", usage);
    expect(cost).toBe(0);
  });

  it("returns 0 for unknown provider", () => {
    const cost = estimateCost("unknown-provider", "some-model", usage);
    expect(cost).toBe(0);
  });

  it("returns 0 for unknown model (no default fallback on non-ollama)", () => {
    const cost = estimateCost("openai", "gpt-99-ultra", usage);
    expect(cost).toBe(0);
  });
});
