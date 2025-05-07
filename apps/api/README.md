# API Backend

The backend API for the Personal Assistant project, built with Cloudflare Workers and designed to interface with various AI providers.

## Features

- OpenAI-compatible API endpoints
- Support for multiple AI providers:
  - Anthropic, Bedrock, OpenAI, Google AI, Mistral, and many more
- Authentication system with multiple methods:
  - GitHub OAuth
  - Session-based auth
  - JWT tokens
  - API key authentication
- Guardrails for content safety (Llamaguard, Bedrock)
- RAG capabilities with Cloudflare Vectorize
- Automated model routing
- Media uploads to Cloudflare R2
- Multi-step conversations
- Agents with setting configuration and configurable MCP servers

## Setup

1. Install dependencies
```bash
pnpm install
```

2. Configure environment variables
```bash
# Copy example env file
cp .dev.vars.example .dev.vars

# Copy example wrangler config
cp wrangler.jsonc.example wrangler.jsonc
```

3. Update the configuration files with your API keys and settings

4. Start the development server
```bash
pnpm run dev
```

## Deployment

This API is designed to be deployed as a Cloudflare Worker:

```bash
pnpm run deploy
```

## Testing

```bash
pnpm run test
```

## API Documentation

### Authentication

The API supports multiple authentication methods:

1. GitHub OAuth
2. Session-based authentication
3. JWT tokens
4. API key authentication

#### GitHub OAuth Flow:

1. Redirect users to `/auth/github`
2. After authorization, users are redirected to the callback URL
3. A session cookie is set
4. Users can then generate JWT tokens or use the session cookie

### Further Documentation

You can find the full [API Documentation here](https://api.polychat.app) which includes the endpoints, parameters, and responses for the API.