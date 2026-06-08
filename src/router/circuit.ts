import type { CircuitBreakerConfig } from "../types/index.js";

export class CircuitBreakerManager {
  private failures = new Map<string, number>();
  private cooldowns = new Map<string, number>();

  private readonly threshold: number;
  private readonly cooldownMs: number;

  constructor(config?: CircuitBreakerConfig) {
    this.threshold = config?.failuresThreshold ?? 3;
    this.cooldownMs = config?.cooldownMs ?? 60_000;
  }

  recordSuccess(provider: string): void {
    this.failures.set(provider, 0);
  }

  recordFailure(provider: string, error: unknown): void {
    const isRateLimit = this.isRateLimit(error);
    const count = (this.failures.get(provider) ?? 0) + 1;
    this.failures.set(provider, count);

    if (isRateLimit || count >= this.threshold) {
      // Trip the circuit!
      const cooldownUntil = Date.now() + this.cooldownMs;
      this.cooldowns.set(provider, cooldownUntil);
      this.failures.set(provider, 0); // Reset count after tripping
    }
  }

  isAvailable(provider: string): boolean {
    const until = this.cooldowns.get(provider);
    if (!until) return true;

    if (Date.now() >= until) {
      this.cooldowns.delete(provider);
      return true;
    }

    return false;
  }

  getCooldownTimeLeft(provider: string): number {
    const until = this.cooldowns.get(provider);
    if (!until) return 0;
    const left = until - Date.now();
    return left > 0 ? left : 0;
  }

  private isRateLimit(error: unknown): boolean {
    if (!error) return false;
    const msg = String(error).toLowerCase();
    
    // Check error string for rate limit indicators
    if (msg.includes("429") || msg.includes("rate_limit") || msg.includes("rate limit") || msg.includes("too many requests")) {
      return true;
    }

    // Check status properties
    const errObj = error as any;
    if (errObj.status === 429 || errObj.statusCode === 429 || errObj.response?.status === 429) {
      return true;
    }

    return false;
  }
}
