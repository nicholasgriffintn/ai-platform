# Configure Polychat

Use the tracked example files as the only source of truth.

## Configuration sources

- API: `apps/api/.dev.vars.example`, `apps/api/wrangler.jsonc.example`, and `apps/api/wrangler.preview-migrations.jsonc.example`
- Web: `apps/app/src/constants.ts` and `apps/app/wrangler.jsonc`
- Training Worker: `apps/training/.dev.vars.example` and `apps/training/wrangler.jsonc.example`
- API `flagship` binding `FLAGS` (set `app_id` to the Flagship app in the Cloudflare dashboard) lets the dashboard override code-defined flags and experiments; without the binding the rules provider alone decides. `MEMORY_SYNTHESIS_ENABLED` and `TRAINING_QUALITY_SCORING_ENABLED` are now the defaults of the `memory_synthesis` and `training_quality_scoring` flags.
- API `worker_loaders` binding `LOADER` backs the `run_code` tool; without it the tool reports that code execution is unavailable and everything else keeps working.
- Optional worker components: follow each component’s `.dev.vars.example` and `wrangler.json`

## Worker Previews

Worker Preview settings live under each manifest's `previews` block. Wrangler does not inherit production bindings or variables into that block, so treat omissions as deliberate isolation rather than copying the production manifest wholesale.

- Keep D1, KV, R2 and Vectorize resources separate from production. Fill the API and training example placeholders before creating a Preview; never replace them with production resources. Tracked container manifests use non-routable `.invalid` host defaults so a Preview cannot trust a production origin by accident.
- Account-level D1, KV, R2, Vectorize and Analytics resources are shared by every Preview that uses the same ID or name. The checked-in configuration deliberately shares one set of non-production resources across Polychat Previews. Keep PII out, serialise destructive seeds and do not run parallel pull-request builds that mutate the shared D1 database.
- Durable Objects and Containers declared in `previews` are isolated by Cloudflare for each named Preview.
- Do not add API, sandbox or training service bindings to a Preview. Cloudflare resolves a Preview service binding to the target Worker's production deployment.
- Queue consumers, cron triggers and production routes do not run on Previews. Exercise those paths through the established local or staging environment instead.
- Preview branch code can read Preview secrets. Use dedicated low-privilege, spend-capped non-production credentials and expose them only to trusted contributors and branches. Base-secret changes affect only new Previews; use `wrangler preview secret put` or `wrangler preview secret bulk` to update an existing named Preview. Never commit secret files.
- Build the app Preview with `VITE_API_BASE_URL`, `VITE_WS_API_URL` and `VITE_WEB_APP_BASE_URL` set to the matching Preview origins. The app otherwise retains its normal production defaults.
- Serve a Preview through its `workers.dev` Preview URL or a Preview-enabled custom domain. Production routes never target a Preview.
- Protect app and API Preview hostnames with Cloudflare Access before storing test credentials or data. Worker-level `preview_worker` Access does not support WebSockets, so use hostname-based Access for realtime testing. An unprotected, time-bounded exception is acceptable only for an unseeded smoke test with no secrets or data.

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
