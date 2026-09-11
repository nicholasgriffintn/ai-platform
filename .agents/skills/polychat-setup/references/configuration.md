# Configure Polychat

Use the tracked example files as the only source of truth.

## Configuration sources

- API: `apps/api/.dev.vars.example` and `apps/api/wrangler.jsonc.example`
- Web: `apps/app/src/constants.ts` and `apps/app/wrangler.jsonc`
- Optional worker components: follow each component’s `.dev.vars.example` and `wrangler.json`

## Core requirements

- Keep `APP_BASE_URL`, `API_BASE_URL`, and a strong `JWT_SECRET`.
- Configure matching D1/KV/R2/queue/Durable Object/Analytics bindings for the selected manifest.
- Preserve separate buckets for public vs private assets.
- Configure at least one usable model provider and verify plan/provider access paths.
- Keep `CONVERSATION_COORDINATOR` configured for serialised conversation writes.
- Run required migrations and seed/membership data before sign-in journeys.

## Secrets and callbacks

Use one environment's secrets with the exact callback URLs for auth, webhooks, allowed origins, and email.
Do not duplicate or inline real keys in docs.

## Optional integrations

- **Embeddings:** use `EMBEDDING_SCOPE_SECRET` and keep credentials stable when vectors are populated.
- **Connectors:** configure Composio keying, webhook signature, and callback URLs in the Composio guide.
- **Coding / training workers:** keep API authority, GitHub App tokens, and worker tokens separate.

## Data writes and settings

- Send only changed fields to `/user/settings`.
- Use explicit `null`, `false`, or empty values when clearing settings.
- Use existing project settings only for project scope; personal scope stays separate.
