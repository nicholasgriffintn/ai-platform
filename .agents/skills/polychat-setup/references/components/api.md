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
- **RAG & Memories** - Vector-based context with Cloudflare Vectorize
- **Training Control Plane** - A training and fine-tuning execution service
- **Content Safety** - Llamaguard and AWS Bedrock Guardrails
- **Flexible Auth** - OAuth, API keys, JWT, magic links, passkeys
- **Real-time** - Streaming responses and WebSocket support

Use the skill's [local setup](../setup.md), [configuration](../configuration.md), and [deployment](../deployment.md) workflows rather than maintaining component-specific setup steps here.

The local API uses `http://localhost:8787` by default. The chat completion route is `/chat/completions`; use the generated OpenAPI reference for the current request contract.

## Runtime infrastructure

The API runs on Cloudflare's global network with:

- D1 for database
- Vectorize for embeddings
- R2 for media storage
- Analytics Engine for metrics
- Service bindings for sandbox and training Workers

## Architecture

- **Framework:** Hono (lightweight HTTP framework)
- **Database:** D1 + Drizzle ORM
- **Validation:** Zod schemas
- **OpenAPI:** Auto-generated docs via hono-openapi
- **Auth:** Multiple providers (OAuth, JWT, API keys, WebAuthn)
- **Storage:** R2 for media, Vectorize for embeddings
- **Training:** API model catalog plus `TRAINING_WORKER` service binding and shared `TRAINING_WORKER_TOKEN` for provider job execution

Repository development rules remain in the root `AGENTS.md`. The workspace uses TypeScript, Vitest, oxfmt, and oxlint.
