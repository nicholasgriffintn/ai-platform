# API Documentation

Welcome to the AI Platform API documentation. This API provides a unified interface to multiple AI models and providers, following OpenAI-compatible conventions while extending functionality with additional features.

## Overview

The API is built on Cloudflare Workers and provides:

- **OpenAI-Compatible Endpoints** - Drop-in replacement for OpenAI API
- **Multi-Provider Support** - Access 40+ AI models from a single API
- **Advanced Features** - Agents, RAG, guardrails, and more
- **Flexible Authentication** - Multiple auth methods to suit your needs
- **Built for Scale** - Powered by Cloudflare's global network

## Core Features

### [Chat Completions](./features/chat-completions.md)
Create conversational AI experiences with support for streaming, multi-turn conversations, and tool calling.

### [Code Generation](./features/code-generation.md)
Specialized endpoints for code completion, editing, and application:
- Fill-in-the-middle (FIM) completions
- Next edit suggestions
- Apply code snippets

### [Models & Capabilities](./features/models.md)
Browse and discover models based on capabilities like vision, function calling, and streaming.

### [Agents](./features/agents.md)
Create AI agents with custom configurations, tools, and MCP server integrations.

### [Authentication](./features/authentication.md)
Secure your API access with GitHub OAuth, magic links, passkeys, JWT tokens, or API keys.

### [Memories & RAG](./features/memories.md)
Store and retrieve context using vector embeddings for enhanced conversations.

### [Guardrails](./features/guardrails.md)
Built-in content safety with Llamaguard and AWS Bedrock Guardrails.

## Getting Started

1. **[Quickstart Guide](./quickstart.md)** - Get up and running in minutes
2. **[Authentication](./features/authentication.md)** - Choose your auth method
3. **[Make Your First Request](./examples/first-request.md)** - Simple example
4. **[API Reference](https://api.polychat.app)** - Complete endpoint documentation

## API Base URL

```
https://api.polychat.app/v1
```

## Support & Community

- **Issues**: [GitHub Issues](https://github.com/nicholasgriffintn/assistant/issues)
- **Live API**: [polychat.app](https://polychat.app)
- **Blog**: [nicholasgriffin.dev/blog](https://nicholasgriffin.dev/blog)

## Usage Limits

The hosted version at polychat.app has the following limits:

- **Unauthenticated**: 10 messages/day
- **Authenticated (Free)**: 50 messages/day
- **Authenticated (Pro tokens)**: 200 pro tokens/day

Pro tokens scale based on model cost, allowing ~22 expensive model messages or ~200 cheaper model messages.

Self-hosted deployments can configure custom limits in `apps/api/src/constants/app.ts`.
