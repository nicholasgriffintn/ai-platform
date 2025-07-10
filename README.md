# AI Platform

A complete AI platform that makes multiple models available from a single application. It features an API platform that has been built out to provide a range of AI interactions and applications alongside a React frontend and a mobile application (in development).

Check out my write up on this project [here](https://nicholasgriffin.dev/blog/building-my-own-ai-assistant). I've also launched a version of this to try out at [polychat.app](https://polychat.app).

> [!NOTE]
> Please note that this project is still in active development so there are a few features that are not yet fully working or fully imagined.
> You can [check out our roadmap here](https://github.com/users/nicholasgriffintn/projects/4/views/2).

![A screenshot of a chat in the frontend application](./docs/images/chat.png)

## Example Chats

Here are some example chats that you can try out:

- [Generation of a new React component](https://polychat.app/s/d27e1e2a-3ddf-495c-9b4f-d6866786f945)
- [Code generation and execution](https://polychat.app/s/51fb196d-7def-4922-94d8-08e7ee86989d)
- [Web search integration](https://polychat.app/s/aa7f6433-fdf8-4a56-bbe8-83fcf5715354)
- [Perplexity Deep Research](https://polychat.app/s/643fcf03-6849-4cbf-8643-abf93660e6dc)
- [Combined artifact previews](https://polychat.app/s/b2137aac-bea5-4dbe-912b-e5ca107cbeca)
- [Markdown formatting](https://polychat.app/s/0ccff6c7-7b62-4936-b18a-c05a098ef7e1)
- [Search Grounding](https://polychat.app/s/0ecf12e1-3ed4-494c-b41d-c60a235df7de)
- [Multi-model responses](https://polychat.app/s/3690158a-33b4-47bf-b831-97834299d71b)
- [Saved memories (RAG)](https://polychat.app/s/1e9a8f6e-e6dc-40a7-b24f-53fb8f4c6766)
- [Retrieved memories (RAG)](https://polychat.app/s/93552889-b3ec-445c-b72b-8d05f5b6117f)
- [Image generation](https://polychat.app/s/fa89a9da-12e0-4308-8ce8-093c4c309de2)
- [Multi Step Tool Calls](https://polychat.app/s/9265e7d7-35e5-438e-b76c-576d12c2f770)
- [Multi Step MCP Calls](https://polychat.app/s/b8e6450f-3a26-4ec8-9c7a-07efd85f88e3)
- [Image Generation](https://polychat.app/s/f4b8f515-d825-4f18-ae01-1310012b1e48)

## Project Structure

This project is organized as a monorepo with multiple applications:

- **app** - Web (PWA) frontend application built with React, TailwindCSS, and React Router
- **api** - Backend API built with Cloudflare Workers that interfaces with AI models and manages user data
- **metrics** - Analytics and monitoring application to track usage and performance

## Features

> [!NOTE]
> I'm also working on a mobile application for this for fun, iOS only. If you're interested, you can [try it out here](https://testflight.apple.com/join/52xrwxRP).

- API structure designed to match the OpenAI API for easy integration with various SDKs and applications.
- Multiple provider and model support
  - Anthropic
  - Bedrock
  - DeepSeek
  - OpenAI
  - Google AI Studio
  - Grok
  - Groq
  - Hugging Face
  - Mistral
  - OpenRouter
  - Perplexity
  - Replicate
  - Cloudflare AI
  - Ollama
  - Github Models
  - Together AI
  - Fireworks AI
  - Certesia
  - ElevenLabs
  - Hyperbolic
  - V0
- [An AI assisted podcasting app](https://nicholasgriffin.dev/blog/launching-an-automated-podcasting-app)
- [Drawing to painting and guessing the drawing app](https://nicholasgriffin.dev/blog/anyone-can-draw)
- Llamaguard Guardrails Support
- [Bedrock Guardrails Support](https://nicholasgriffin.dev/blog/protecting-content-with-aws-bedrock-guardrails)
- [Benchmarking](https://nicholasgriffin.dev/blog/building-a-tool-to-benchmark-ai)
- [RAG with Vectorize](https://nicholasgriffin.dev/blog/adding-rag-to-my-ai-assistant)
- [Automated model routing](https://nicholasgriffin.dev/blog/building-a-first-party-prompt-router)
- [Bedrock Knowledge Bases](https://nicholasgriffin.dev/blog/trying-out-bedrock-knowledge-bases)
- Prompt Coaching
- Monitoring with Cloudflare Analytics Engine
- Media uploading to Cloudflare R2
- [Conversation to Markdown for models that don't support native PDF or other document uploads](https://nicholasgriffin.dev/blog/using-markdown-conversion-to-add-documents-to-ai-chat-context)
- Multiple authentication methods:
  - GitHub OAuth
  - Magic Link
  - Passkeys
  - Session-based authentication
  - JWT authentication
- A frontend application built with React and TailwindCSS
  - Uses the API app for authentication and AI requests
  - Retrieves and displays conversations and makes it easy to create new ones
  - Has the option to store conversations locally in IndexedDB or in LocalStorage (if IndexedDB is not supported)
  - Set chat titles and delete chats
  - Configure settings and models
  - [Web LLM](https://github.com/mlc-ai/web-llm) support for completely offline usage
- The API is deployed as a Cloudflare Worker and the frontend is deployed with Cloudflare Assets

## Usage Limits

Polychat is configured with usage limits to prevent abuse. These limits are as follows:

- 10 standard messages per day for unauthenticated users
- 50 standard messages per day for authenticated users
- 200 pro tokens per day for authenticated users

Pro tokens are calculated based on a multiplier of the cost of the model. For example, if a model costs $0.01 per 1000 input tokens and $0.05 per 1000 output tokens, then the pro token limit is 200 * (0.01 + 0.05) / 2 = 6.

This equates to around:

- Expensive models (9x): ~22 messages
- Mid-tier models (3x): ~66 messages
- Cheaper models (1-2x): 100-200 messages

If you are providing your own service and would like to change these limits, you can do so by changing the `USAGE_CONFIG` object in the `apps/api/src/constants/app.ts` file.

## Setup and Installation

### Getting Started

1. Clone the repository
2. Install dependencies
   ```bash
   pnpm install
   ```

3. Configure environment variables:
   - Copy `.dev.vars.example` to `.dev.vars` in all the apps directories that have them.
   - Copy `wrangler.jsonc.example` to `wrangler.jsonc` in all the apps directories that have them.
   - Adjust with your API keys and configuration values.

4. Start the development servers:
   ```bash
   # Start all apps in development mode
   pnpm run dev
   
   # Or start individual apps
   pnpm run dev:app
   pnpm run dev:api
   pnpm run dev:metrics
   ```

### Deployment

The applications are designed to be deployed to Cloudflare:

```bash
# Deploy all applications
npm run deploy

# Deploy individual applications
npm run deploy:app
npm run deploy:api
npm run deploy:metrics
```

## API Documentation

### Authentication Flow

1. User initiates login by visiting: `https://api.polychat.app/auth/github`
2. User is redirected to GitHub to authorize the application
3. After authorization, GitHub redirects back to `https://api.polychat.app/auth/github/callback`
4. The API creates or updates the user record and generates a session
5. User is redirected back to the specified `redirect_uri` with a session cookie set
6. The application can choose to use the session cookie or generate a JWT token

### Using the Authentication

The authentication system uses HTTP cookies for session management. When a user successfully authenticates, a `session` cookie is set with the session ID.

For API requests, the session ID can be included in one of these ways:

1. Automatically via the session cookie (for browser-based requests)
2. As a Bearer token in the Authorization header:
   ```
   Authorization: Bearer your_session_id
   ```

### User Information

To get information about the authenticated user, make a GET request to `/auth/me`. This endpoint will use the session cookie or Authorization header to identify the user.

### Generating a JWT Token

To generate a JWT token for the authenticated user, make a POST request to `/auth/token`. This endpoint will use the session cookie or Authorization header to identify the user.

The JWT token will be returned in the response body and can then be used to make API requests to the other endpoints.

### Logging Out

To log out, make a POST request to `/auth/logout`. This will invalidate the session and clear the session cookie. 

## AI Model Integration

The application supports multiple AI providers through a unified API interface. To use a specific provider:

1. Configure the API keys in your environment variables
2. Select the provider and model in the frontend settings or specify them in API requests

Example API request:
```json
POST /chat/completions
{
  "model": "gpt-4",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello world!"}
  ]
}
```

## Database Management

The application uses a Cloudflare D1 database with Drizzle ORM for schema management and migrations.

### Running Migrations

```bash
cd apps/api
# Migrate to the local database
pnpm run db:migrate:local

# Migrate to the preview database
pnpm run db:migrate:preview

# Migrate to the production database
pnpm run db:migrate:prod
```

To generate a new migration, run:

```bash
pnpm run db:generate
```

## Monitoring and Analytics

The metrics application provides dashboards for monitoring:

- API usage and performance
- Model performance and costs
- User activity and engagement

Access the metrics dashboard at [metrics.polychat.app](https://metrics.polychat.app).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the terms of the license included in the repository.
