# API Overview

Cloudflare Worker backend serving OpenAI-compatible endpoints, provider routing, guardrails, and analytics for Polychat.

## Directory Highlights

- `src/index.ts` – Hono entrypoint registering middleware, routes, and error handling.
- `src/routes/` – HTTP route handlers (chat, tools, apps, auth, metrics).
- `src/services/` – Business logic for completions, dynamic apps, metrics, etc.
- `src/lib/` – Core primitives (providers, models, cache, monitoring, usage manager).
- `src/repositories/` – D1 database access via Drizzle ORM.
- `src/lib/database/schema.ts` – Source of truth for D1 schema; migrations generated from here.
- `migrations/` – Drizzle-generated SQL migration files (auto-generated only).
- `wrangler.jsonc` – Worker bindings (D1, KV, Vectorize, R2, rate limiters).

## Local Commands

- **Dev server**
  ```sh
  pnpm --filter @assistant/schemas build
  pnpm --filter @assistant/api dev
  ```
- **Type checking**
  ```sh
  pnpm --filter @assistant/api typecheck
  ```
- **Lint & format**
  ```sh
  pnpm --filter @assistant/api lint
  pnpm --filter @assistant/api format
  ```
- **Unit tests / coverage**
  ```sh
  pnpm --filter @assistant/api test
  pnpm --filter @assistant/api coverage
  ```
- **Migrations**
  ```sh
  pnpm --filter @assistant/api db:generate      # create new migration (adds file under migrations/)
  pnpm --filter @assistant/api db:migrate:local # apply to local D1 (requires wrangler)
  ```

## Testing Expectations

- Run `pnpm --filter @assistant/api test` and `pnpm --filter @assistant/api typecheck` before pushing worker changes.
- When routes or schemas change, execute `pnpm --filter @assistant/schemas build` to ensure shared types stay in sync.
- Regenerate and apply migrations locally for any schema changes; include the generated SQL in the PR.
- Integration tests rely on wrangler’s D1 bindings; prefer Vitest unit tests for provider/service logic.

## Guardrails

- Do not hand-edit files under `migrations/`; regenerate via Drizzle CLI.
- Avoid committing secrets: `.dev.vars`, `.wrangler`, and `wrangler.jsonc` contain sensitive data—change them only with maintainer approval.
- Provider implementations live under `src/lib/providers/**`; reuse factory hooks and monitoring helpers when adding new providers.
- Usage limits/constants in `src/constants/app.ts` affect quota logic—coordinate changes with frontend/state owners.
- Keep `src/lib/models/**` configurations consistent with shared schemas and pricing data; update usage manager if costs change.
- Background registrations (`autoRegisterDynamicApps`) run at startup—ensure new services are idempotent.
