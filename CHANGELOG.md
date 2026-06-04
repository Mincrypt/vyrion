# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-06-05

### Added
- **License**: Included the MIT License file in the package distribution and GitHub repository.

## [0.1.0] - 2026-06-04

### Added
- **Unified Provider Interface**: Standardized client wrapper for 7 LLM providers (OpenAI, Groq, Gemini, Anthropic, Mistral, Together AI, Ollama) using optional peer-dependencies.
- **Smart Routing & Goal Strategies**: Select models dynamically using `"auto"`, `"fastest"` (recent latency), `"cheapest"` (cost tracking), or `"best"` (top-tier performance).
- **Graceful Fallbacks**: Multi-provider retry sequence (failover) with custom fallback queues and custom-defined timeout handling.
- **Cost Estimation**: Integrated token pricing calculator using dynamic usage backfills.
- **Analytics & Health Metrics**: Background check cycles using `.unref()` timers to monitor provider health without hanging Node.js, and rolling 50-request latency tracker.
- **Plugin Registry**: Extend the library by registering custom runtime adapters using the `registerProvider` API.
- **Dual Builds**: Out-of-the-box ESM and CommonJS support built via `tsup`.
