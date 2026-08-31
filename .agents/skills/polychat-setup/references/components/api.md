# API Worker

OpenAI-compatible API with 40+ models, built on Cloudflare Workers.

## Overview

The API provides a unified interface to multiple AI providers, following OpenAI's API conventions while extending functionality with agents, RAG, guardrails, and specialized code generation endpoints.

**Base URL:** `https://api.polychat.app`

## Key Features

- **OpenAI-Compatible** - Drop-in replacement for OpenAI API
- **40+ AI Models** - Anthropic, OpenAI, Google, Mistral, Meta, and more
- **Code Specialized** - FIM completions, edit suggestions, code application
- **AI Agents** - Custom agents with MCP server integrations
- **Skills** - Specialised instructions the model loads on demand instead of carrying in every prompt
- **RAG & Memories** - Vector-based context with Cloudflare Vectorize
- **Training Control Plane** - A training and fine-tuning execution service
- **Content Safety** - Llamaguard and AWS Bedrock Guardrails
- **Flexible Auth** - OAuth, API keys, JWT, magic links, passkeys
- **Real-time** - Streaming responses and WebSocket support
- **Durable goal history** - Goal lifecycle markers remain in stored conversation timelines while
  staying out of model context
- **Sandbox-backed project tasks** - Work can dispatch repository-native runs without turning them
  into a second chat pipeline

Use the skill's [local setup](../setup.md), [configuration](../configuration.md), and [deployment](../deployment.md) workflows rather than maintaining component-specific setup steps here.

Document research is a loadable skill over the read-only `search_documents` tool. It teaches the shared agent loop to refine searches and reconcile evidence from authorised personal or project material. Keep it separate from the `research` tool, which delegates paid deep-web research to an external provider; private document passages must not cross into that provider.

The local API uses `http://localhost:8787` by default. The chat completion route is `/chat/completions`; use the generated OpenAPI reference for the current request contract.

Automatic routing modes prefer their matching model tier. If that tier has no model which is both accessible to the person and suitable for the prompt's capabilities, route through the broader accessible automatic pool instead of failing the turn.

When a chat request omits its output-token limit, resolve a workload-aware default before calling the provider: 2,048 for structured JSON, 8,192 for ordinary chat, 16,384 for agent or coding work, and 32,768 for reasoning models. An explicit `max_tokens`, `max_completion_tokens`, or `max_output_tokens` value overrides that default and is clamped only to the selected model's catalogue limit.

For OpenAI text models, keep Polychat's public route independent of the upstream transport. Route models that require Responses, requests for supported OpenAI-hosted tools, and function-tool requests with a non-`none` reasoning effort through `/v1/responses`; use Chat Completions for compatible requests. Model capability metadata is the authority for which hosted tools, reasoning levels, and upstream streaming modes the UI may offer.

Import supported reasoning effort levels from models.dev `reasoning_options`. Preserve local defaults and model overrides when synchronising; models.dev does not own those product choices. Keep granular hosted-tool capabilities in the provider catalogue because models.dev exposes only general tool-calling support.

Forward a configured non-default `reasoning_effort` through Mistral, OpenRouter, and Requesty chat-completion adapters. Preserve Mistral thinking chunks separately from answer text while streaming and replay the complete thinking chunk in later Mistral turns; dropping it degrades multi-turn reasoning quality.

## Lean proof project tasks

Lean Proofs is a Pro, Work-only experience. Authenticated project members list, create, and inspect runs through `/projects/:projectId/lean-proofs`; creation also requires the `featured-lean-proofs` app to be enabled and a complete project coding environment.

Treat the submitted body as proof intent, not execution authority. It contains repository-relative target paths, optional qualified declarations, an objective, acceptance criteria, and an optional token budget. The API derives the repository and GitHub installation from the project, fixes the model to `labs-leanstral-1-5`, revalidates the starting member's GitHub authority, and rejects direct Lean requests through the generic sandbox-run route.

The project-task delivery claims one exact dispatch, creates a goal owned by one sandbox run, attaches the run to the task, and enqueues sandbox execution. Terminal sandbox delivery then matches the queue message, activity record, immutable run payload, project-task context, goal owner, and stored anchors before it changes the task. Duplicate delivery reuses the same terminal projection; stale or mismatched delivery cannot create another output or advance the task.

Successful `compiled` and `kernel_checked` runs create an internal project output of kind `lean.proof` and stop in human review. `incomplete` results block with `verification_failed`, execution failures block with `run_failed`, and cancellation clears both task and sandbox execution. Model usage is added to `tokensSpent`, and retries receive only the remaining task budget.

## Runtime infrastructure

The API runs on Cloudflare's global network with:

- D1 for database
- Vectorize for embeddings
- R2 for media storage
- Analytics Engine for metrics
- Service bindings for sandbox and training Workers

Lean proof tasks require the sandbox service binding to point at a deployment that includes the `LeanSandbox` Durable Object and standard-3 container. They also require migrations 0007 through 0009 for the run/output anchors, projection claim, idempotency key, and their unique indexes before the routes are exposed.

## Architecture

- **Framework:** Hono (lightweight HTTP framework)
- **Database:** D1 + Drizzle ORM
- **Validation:** Zod schemas
- **OpenAPI:** Auto-generated docs via hono-openapi
- **Auth:** Multiple providers (OAuth, JWT, API keys, WebAuthn)
- **Storage:** R2 for media, Vectorize for embeddings
- **Training:** API model catalog plus `TRAINING_WORKER` service binding and shared `TRAINING_WORKER_TOKEN` for provider job execution

Repository development rules remain in the root `AGENTS.md`. The workspace uses TypeScript, Vitest, oxfmt, and oxlint.
