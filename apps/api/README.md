# API

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

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
# Copy example files
cp .dev.vars.example .dev.vars
cp wrangler.jsonc.example wrangler.jsonc

# Edit .dev.vars with your API keys
```

### 3. Run Development Server

```bash
pnpm run dev
```

API will be available at `http://localhost:8787`

### 4. Make Your First Request

```bash
curl http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Development

### Commands

```bash
pnpm run dev              # Start dev server
pnpm run deploy           # Deploy to Cloudflare
pnpm run test             # Run tests
pnpm run db:migrate:local # Run database migrations
```

### Database

This API uses Cloudflare D1 with Drizzle ORM:

```bash
# Generate migrations
pnpm run db:generate

# Apply migrations locally
pnpm run db:migrate:local

# Apply to production
pnpm run db:migrate:prod
```

## Deployment

Deploy to Cloudflare Workers:

```bash
pnpm run deploy
```

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

**[Read more →](./AGENTS.md)**

## Contributing

This project uses:

- TypeScript for type safety
- Biome for linting/formatting
- Vitest for testing
- Conventional commits

See [AGENTS.md](./AGENTS.md) for development guidelines.

## License

See repository license.
