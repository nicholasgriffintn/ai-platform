# Configure Polychat

Use the tracked example files as the only source of truth.

## Configuration sources

- API: `apps/api/.dev.vars.example` and `apps/api/wrangler.jsonc.example`
- Web: `apps/app/src/constants.ts` and `apps/app/wrangler.jsonc`
- API `flagship` binding `FLAGS` (set `app_id` to the Flagship app in the Cloudflare dashboard) lets the dashboard override code-defined flags and experiments; without the binding the rules provider alone decides. `MEMORY_SYNTHESIS_ENABLED` and `TRAINING_QUALITY_SCORING_ENABLED` are now the defaults of the `memory_synthesis` and `training_quality_scoring` flags.
- API `worker_loaders` binding `LOADER` backs the `run_code` tool; without it the tool reports that code execution is unavailable and everything else keeps working.
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
- **Channels:** configure `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN`, and `SLACK_BOT_USER_ID` for one Slack installation. Subscribe to `app_mention` and the applicable message events, including `message.im` for direct messages. Bind the exact Slack workspace and channel, choose an explicit sender allowlist, and use mention mode unless every allowed message should start a thread. Configure `TELEGRAM_WEBHOOK_SECRET` and `TELEGRAM_BOT_TOKEN` for personal Telegram bindings.
- **Telemetry:** set `OTEL_EXPORTER_OTLP_ENDPOINT` to the public HTTPS collector base URL, including any tenant path. Store collector credentials in `OTEL_EXPORTER_OTLP_HEADERS` as percent-encoded header pairs; use `OTEL_SERVICE_NAME` for the resource name. Pass the Worker background context or explicitly flush telemetry before the host finishes. Native OTLP excludes conversation content and personal identity.
- **Enterprise identity:** configure OIDC in workspace **People & access** after migration `0059_enterprise_identity`. Register the displayed callback with a confidential client using HTTP Basic authentication, S256 PKCE, RS256 or ES256 signatures, and explicit complete group claims. Add separate endpoint origins only when required by discovery. Keep `JWT_SECRET` stable for encrypted client credentials; refresh leased access through **Account → Company access**.
- **Coding / training workers:** keep API authority, GitHub App tokens, and worker tokens separate.

## Data writes and settings

- Send only changed fields to `/user/settings`.
- Use explicit `null`, `false`, or empty values when clearing settings.
- Use existing project settings only for project scope; personal scope stays separate.
