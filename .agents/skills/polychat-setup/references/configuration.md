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
- **Coding / training workers:** keep API authority, GitHub App tokens, and worker tokens separate.
- **GitHub PR review:** apply migration `0058_project_task_integrations` before deploying the API. Keep `TASK_QUEUE` and the ordinary Work model/usage bindings configured. The connected GitHub App needs repository contents and pull-request read access, pull-request write access for human-approved publication, and issue read access for issue imports.

Configure a non-empty GitHub App webhook secret and subscribe the existing `/webhooks/github` callback to pull-request events for automatic reviews. Intake handles `opened`, `synchronize`, `reopened` and `ready_for_review`; it skips drafts and closed PRs. A missing secret rejects webhook processing, including comment commands. A PR `/review` comment uses the commit-bound Work path only when exactly one enabled policy for that repository belongs to the linked author; otherwise the response directs the author to select a project in Work. Repository-level issue commands retain their existing execution path.

## Data writes and settings

- Send only changed fields to `/user/settings`.
- Use explicit `null`, `false`, or empty values when clearing settings.
- Use existing project settings only for project scope; personal scope stays separate.
