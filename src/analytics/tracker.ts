import type { ProviderStats, AnalyticsSnapshot } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Analytics Tracker
//  In-memory store for per-provider request statistics.
//  Keeps a rolling window of the last N latency samples for
//  accurate average-latency computation used by the router.
// ─────────────────────────────────────────────────────────────

const LATENCY_WINDOW = 50; // Keep last 50 latency readings per provider

export interface AnalyticsEvent {
  provider: string;
  latency: number;
  tokens: number;
  cost: number;
  success: boolean;
}

interface ProviderBucket {
  requests: number;
  errors: number;
  totalTokens: number;
  totalCost: number;
  totalLatency: number;
  /** Rolling window of recent latencies */
  recentLatencies: number[];
}

export class AnalyticsTracker {
  private buckets = new Map<string, ProviderBucket>();
  private readonly since: Date;

  constructor() {
    this.since = new Date();
  }

  // ── Recording ────────────────────────────────────────────

  record(event: AnalyticsEvent): void {
    let bucket = this.buckets.get(event.provider);
    if (!bucket) {
      bucket = {
        requests: 0,
        errors: 0,
        totalTokens: 0,
        totalCost: 0,
        totalLatency: 0,
        recentLatencies: [],
      };
      this.buckets.set(event.provider, bucket);
    }

    bucket.requests++;
    bucket.totalTokens += event.tokens;
    bucket.totalCost += event.cost;

    if (!event.success) {
      bucket.errors++;
    } else {
      bucket.totalLatency += event.latency;
      bucket.recentLatencies.push(event.latency);
      if (bucket.recentLatencies.length > LATENCY_WINDOW) {
        bucket.recentLatencies.shift();
      }
    }
  }

  // ── Querying ─────────────────────────────────────────────

  getProviderStats(provider: string): ProviderStats | undefined {
    const b = this.buckets.get(provider);
    if (!b) return undefined;
    return this.toStats(provider, b);
  }

  getSnapshot(): AnalyticsSnapshot {
    const providers: ProviderStats[] = [];
    let totalRequests = 0;
    let totalErrors = 0;
    let totalTokens = 0;
    let totalCost = 0;

    for (const [name, bucket] of this.buckets) {
      const stats = this.toStats(name, bucket);
      providers.push(stats);
      totalRequests += stats.requests;
      totalErrors += stats.errors;
      totalTokens += stats.totalTokens;
      totalCost += stats.totalCost;
    }

    return { totalRequests, totalErrors, totalTokens, totalCost, providers, since: this.since };
  }

  reset(): void {
    this.buckets.clear();
  }

  // ── Private ──────────────────────────────────────────────

  private toStats(provider: string, b: ProviderBucket): ProviderStats {
    const successfulRequests = b.requests - b.errors;
    const avgLatency =
      b.recentLatencies.length > 0
        ? b.recentLatencies.reduce((a, c) => a + c, 0) / b.recentLatencies.length
        : 0;

    return {
      provider,
      requests: b.requests,
      errors: b.errors,
      totalTokens: b.totalTokens,
      totalCost: b.totalCost,
      totalLatency: b.totalLatency,
      avgLatency: Math.round(avgLatency),
      errorRate: b.requests > 0 ? b.errors / b.requests : 0,
    };
  }
}
