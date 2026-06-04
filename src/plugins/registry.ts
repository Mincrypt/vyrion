import type { IProvider } from "../providers/base.js";
import type { ChatRequest, ChatResponse, StreamChunk, HealthCheckResult } from "../types/index.js";

// ─────────────────────────────────────────────────────────────
//  Plugin Registry
//  Allows developers to register custom LLM providers that
//  will be treated identically to built-in providers by the
//  router, analytics, and health monitor.
// ─────────────────────────────────────────────────────────────

/**
 * Minimal shape required to register a custom provider.
 * All fields of IProvider are required except supportedModels.
 */
export interface ProviderPlugin {
  name: string;
  defaultModel: string;
  supportedModels?: string[];
  isAvailable(): boolean;
  chat(req: ChatRequest): Promise<ChatResponse>;
  stream(req: ChatRequest): AsyncGenerator<StreamChunk>;
  healthCheck(): Promise<HealthCheckResult>;
}

/**
 * Wraps a ProviderPlugin into a full IProvider shape.
 */
class PluginAdapter implements IProvider {
  readonly name: string;
  readonly defaultModel: string;
  readonly supportedModels: string[];

  constructor(private readonly plugin: ProviderPlugin) {
    this.name = plugin.name;
    this.defaultModel = plugin.defaultModel;
    this.supportedModels = plugin.supportedModels ?? [plugin.defaultModel];
  }

  isAvailable(): boolean { return this.plugin.isAvailable(); }
  chat(req: ChatRequest): Promise<ChatResponse> { return this.plugin.chat(req); }
  stream(req: ChatRequest): AsyncGenerator<StreamChunk> { return this.plugin.stream(req); }
  healthCheck(): Promise<HealthCheckResult> { return this.plugin.healthCheck(); }
}

export class PluginRegistry {
  private readonly plugins = new Map<string, IProvider>();

  /**
   * Register a custom provider plugin.
   * @throws if a plugin with the same name is already registered.
   */
  register(plugin: ProviderPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(
        `A provider named "${plugin.name}" is already registered. ` +
          `Use a unique name or call unregister("${plugin.name}") first.`
      );
    }
    this.validatePlugin(plugin);
    this.plugins.set(plugin.name, new PluginAdapter(plugin));
  }

  /**
   * Remove a previously registered plugin.
   */
  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  /**
   * Get all registered plugin adapters (used internally by Vyrion to
   * merge them into the provider map).
   */
  getAll(): Map<string, IProvider> {
    return new Map(this.plugins);
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  // ── Validation ───────────────────────────────────────────

  private validatePlugin(plugin: ProviderPlugin): void {
    const required: Array<keyof ProviderPlugin> = [
      "name",
      "defaultModel",
      "isAvailable",
      "chat",
      "stream",
      "healthCheck",
    ];
    for (const key of required) {
      if (plugin[key] === undefined || plugin[key] === null) {
        throw new Error(`Plugin is missing required property: "${key}"`);
      }
    }
    if (typeof plugin.name !== "string" || plugin.name.trim() === "") {
      throw new Error("Plugin name must be a non-empty string.");
    }
  }
}
