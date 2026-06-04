import type { IProvider } from "../providers/base.js";
import type { HealthCheckResult, HealthStatus } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Health Monitor
//  Periodically probes all registered providers and caches
//  their status. Results are used by the router to avoid
//  sending requests to degraded or down providers.
// ─────────────────────────────────────────────────────────────

const DEFAULT_INTERVAL_MS = 5 * 60 * 1_000; // 5 minutes

export class HealthMonitor {
  private readonly cache = new Map<string, HealthCheckResult>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private providers: IProvider[] = [];

  constructor(private readonly intervalMs = DEFAULT_INTERVAL_MS) {}

  // ── Lifecycle ────────────────────────────────────────────

  start(providers: IProvider[]): void {
    this.providers = providers;
    // Run immediately then on interval
    void this.checkAll();
    this.timer = setInterval(() => void this.checkAll(), this.intervalMs);
    // Prevent the timer from keeping the process alive
    if (this.timer.unref) this.timer.unref();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // ── Public API ───────────────────────────────────────────

  /**
   * Get cached health for a specific provider.
   * Returns "unknown" if no check has run yet.
   */
  getStatus(provider: string): HealthStatus {
    return this.cache.get(provider)?.status ?? "unknown";
  }

  /**
   * Get all cached health results.
   */
  getAllStatuses(): HealthCheckResult[] {
    return [...this.cache.values()];
  }

  /**
   * Trigger an immediate check of all providers.
   */
  async checkAll(): Promise<HealthCheckResult[]> {
    const results = await Promise.allSettled(
      this.providers.filter((p) => p.isAvailable()).map((p) => p.healthCheck())
    );

    const resolved: HealthCheckResult[] = results.map((r, i) => {
      if (r.status === "fulfilled") {
        this.cache.set(r.value.provider, r.value);
        return r.value;
      }
      const provider = this.providers[i]!;
      const failed: HealthCheckResult = {
        provider: provider.name,
        status: "down",
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        checkedAt: new Date(),
      };
      this.cache.set(provider.name, failed);
      return failed;
    });

    return resolved;
  }

  /**
   * Check a single provider immediately.
   */
  async check(provider: IProvider): Promise<HealthCheckResult> {
    const result = await provider.healthCheck();
    this.cache.set(provider.name, result);
    return result;
  }
}
