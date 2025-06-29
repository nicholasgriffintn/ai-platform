# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **complete AI platform monorepo** called "Polychat" that provides multiple AI models through a unified interface. The platform consists of three main applications deployed on Cloudflare infrastructure.

### Applications

- **`apps/app/`** - React-based web and mobile frontend application
- **`apps/api/`** - Cloudflare Workers backend API with 20+ AI provider integrations
- **`apps/metrics/`** - Analytics and monitoring dashboard

## Monorepo Commands

### Root-Level Development

- `pnpm install` - Install all dependencies across workspace
- `pnpm run dev` - Start API and app in development mode simultaneously
- `pnpm run dev:api` - Start only the API backend
- `pnpm run dev:app` - Start only the frontend app
- `pnpm run dev:metrics` - Start only the metrics dashboard

### Code Quality (All Apps)

- `pnpm run lint` - Run linting across all apps
- `pnpm run format` - Format code across all apps
- `pnpm run check` - Run Biome check across all apps
- `pnpm run typecheck` - Run TypeScript checking across all apps

### Testing

- `pnpm run test` - Run unit tests across workspace (Vitest)
- `pnpm run coverage` - Generate test coverage reports
- `pnpm run test:e2e` - Run end-to-end tests (Playwright)

### Deployment

- `pnpm run deploy` - Deploy all applications to Cloudflare
- `pnpm run deploy:api` - Deploy only the API
- `pnpm run deploy:app` - Deploy only the frontend
- `pnpm run deploy:metrics` - Deploy only the metrics dashboard

## Architecture Overview

### Backend API (`apps/api/`)

**Cloudflare Workers-based API** that provides OpenAI-compatible endpoints with extensive AI provider integration.

**Key Features:**

- **20+ AI Providers** - Anthropic, OpenAI, Google, Mistral, Groq, Bedrock, etc.
- **Unified API Interface** - OpenAI-compatible for easy SDK integration
- **Advanced Features** - RAG with Vectorize, guardrails, model routing, prompt coaching
- **Authentication** - GitHub OAuth, magic links, passkeys, JWT/session-based
- **Storage** - Cloudflare D1 database with Drizzle ORM
- **File Handling** - Cloudflare R2 for media uploads, document conversion

**Technology Stack:**

- Cloudflare Workers, Hono framework, TypeScript
- Drizzle ORM with D1 database
- Zod validation, comprehensive testing with Vitest

### Frontend App (`apps/app/`)

**React-based web and mobile application** with offline-first architecture.

**Key Features:**

- **Multi-Modal Chat Interface** - Text, image, document, and audio support
- **Dynamic Apps** - Articles, Podcasts, Drawings, Notes with specialized UIs
- **Offline-First** - IndexedDB storage with cloud sync
- **Cross-Platform** - Web app + iOS/Android via Capacitor
- **Local AI** - Web-LLM for client-side inference

**Technology Stack:**

- React 19, React Router v7, TailwindCSS, TypeScript
- State: Zustand + TanStack Query, Capacitor for mobile

### Metrics Dashboard (`apps/metrics/`)

**Analytics and monitoring application** for tracking platform usage and performance.

**Technology Stack:**

- React + Vite, deployed on Cloudflare Pages
- Charts and data visualization for API metrics

## Development Patterns

### Database Management (API)

```bash
cd apps/api
pnpm run db:migrate:local    # Apply migrations locally
pnpm run db:migrate:preview  # Apply to preview environment
pnpm run db:migrate:prod     # Apply to production
pnpm run db:generate         # Generate new migration
```

### Mobile Development (App)

```bash
cd apps/app
pnpm run build              # Build web assets first
pnpm run sync              # Sync to mobile projects
pnpm run dev:ios           # Run iOS simulator
npx cap open ios           # Open Xcode
```

### Environment Configuration

- Copy `.dev.vars.example` → `.dev.vars` in app directories that have them
- Copy `wrangler.jsonc.example` → `wrangler.jsonc` in app directories that have them
- Root-level configuration managed via workspace

## Important Implementation Notes

### AI Provider Integration

- Unified interface in `apps/api/src/lib/models/` supports 20+ providers
- OpenAI-compatible API design enables easy SDK integration
- Model routing, cost tracking, and usage limits built-in

### Authentication Flow

1. Multiple auth methods: GitHub OAuth, magic links, passkeys
2. Session-based with optional JWT token generation
3. Cookie-based sessions for browser, Bearer tokens for API

### Data Storage Strategy

- **Frontend**: IndexedDB-first with LocalStorage fallback, cloud sync when authenticated
- **Backend**: Cloudflare D1 (SQLite) with Drizzle ORM, R2 for file storage
- **Caching**: Multi-layer caching strategy for performance

### Deployment Architecture

- **API**: Cloudflare Workers with D1 database
- **Frontend**: Cloudflare Pages with assets
- **Mobile**: Capacitor builds for iOS/Android app stores
- **Metrics**: Cloudflare Pages for analytics dashboard

### Code Quality Standards

- **TypeScript** strict mode across all applications
- **Biome** for linting and formatting (replaces ESLint/Prettier)
- **Vitest** for unit testing, Playwright for E2E testing
- **Path aliases**: `~/*` maps to `src/*` in each app

### Common Development Workflows

1. **New Feature Development**: Start with API changes, then frontend implementation
2. **Testing**: Always run `pnpm run typecheck` before commits
3. **Database Changes**: Generate migrations in API, test locally before deploy
4. **Multi-App Changes**: Use root-level commands for consistency

The platform follows a **mobile-first, offline-capable, multi-provider** architecture that prioritizes user experience and developer productivity. All applications use modern JavaScript/TypeScript patterns with comprehensive type safety.
