# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-08

### Added
- **Multi-Modal Support**: Unified support for sending images, PDFs, text, and document files. Automatically mapped natively to Gemini and Anthropic, with OpenAI mapping images and text-based attachments while raising clean errors for binary files.
- **Circuit Breaker & Automatic Cooldown**: Tracks provider health dynamically, tripping on consecutive failures or HTTP 429 rate limit responses. Bypasses cooling-down providers or demotes them during fallback routing.
- **Streaming Caching & Playback**: Implements caching for streaming responses. Plays back cached chunks sequentially with a simulated `15ms` delay to preserve smooth user experience on cache hits.

## [0.1.2] - 2026-06-05

### Fixed
- **Gemini & Anthropic Health Checks**: Fixed a bug where health check model queries were hardcoded, preventing users with overridden/custom default models from passing the health probe. Model selection is now dynamically selected based on configuration.
- **Gemini Default Model**: Changed the default model to `gemini-2.5-flash` to offer improved rate limits and stabler out-of-the-box performance.

### Added
- **Pricing Updates**: Added cost metrics for `gemini-2.5-flash` and `gemini-2.5-pro` in the cost tracker.

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
