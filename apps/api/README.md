# API

OpenAI-compatible API with 40+ models, built on Cloudflare Workers.

## Overview

The API provides a unified interface to multiple AI providers, following OpenAI's API conventions while extending functionality with agents, RAG, guardrails, and specialized code generation endpoints.

**Base URL:** `https://api.polychat.app/v1`

## Documentation

**[Complete API Documentation](./docs/README.md)**

### Quick Links

- **[Getting Started](./docs/README.md)** - API overview and quickstart
- **[Authentication](./docs/features/authentication.md)** - OAuth, API keys, JWT, magic links, passkeys
- **[Chat Completions](./docs/features/chat-completions.md)** - Core chat API with streaming and tools
- **[Code Generation](./docs/features/code-generation.md)** - FIM, edit, and apply endpoints
- **[Models](./docs/features/models.md)** - Browse 40+ available models
- **[Agents](./docs/features/agents.md)** - Custom AI agents with MCP servers
- **[Memories](./docs/features/memories.md)** - RAG with vector embeddings
- **[Guardrails](./docs/features/guardrails.md)** - Content safety and moderation
- **[Live API Reference](https://api.polychat.app)** - OpenAPI documentation

## Key Features

- **OpenAI-Compatible** - Drop-in replacement for OpenAI API
- **40+ AI Models** - Anthropic, OpenAI, Google, Mistral, Meta, and more
- **Code Specialized** - FIM completions, edit suggestions, code application
- **AI Agents** - Custom agents with MCP server integrations
- **RAG & Memories** - Vector-based context with Cloudflare Vectorize
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

## Architecture

- **Framework:** Hono (lightweight HTTP framework)
- **Database:** D1 + Drizzle ORM
- **Validation:** Zod schemas
- **OpenAPI:** Auto-generated docs via hono-openapi
- **Auth:** Multiple providers (OAuth, JWT, API keys, WebAuthn)
- **Storage:** R2 for media, Vectorize for embeddings

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
