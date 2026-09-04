# Configure Polychat

Configure the selected capabilities from tracked examples and active Wrangler manifests. An adapter in the repository does not prove a deployment has its credentials or infrastructure.

## Configuration sources

| Component | Variable names and bindings                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| API       | `apps/api/.dev.vars.example`, `apps/api/wrangler.jsonc.example`; active ignored manifest `apps/api/wrangler.json` |
| Web       | `apps/app/src/constants.ts`, public build-time environment settings and `apps/app/wrangler.jsonc`                 |
| Sandbox   | `apps/sandbox-worker/.dev.vars.example`, `apps/sandbox-worker/wrangler.json`                                      |
| Training  | `apps/training/.dev.vars.example`, `apps/training/wrangler.json`                                                  |

Never copy real secret values into documentation or tracked configuration.

## Core requirements

- Set matching web/API/WebSocket origins, `APP_BASE_URL`, `API_BASE_URL` and a strong `JWT_SECRET`.
- Provision the D1, KV, R2, queues, Analytics Engine, Durable Objects and provider bindings required by the active manifest. Keep `CONVERSATION_COORDINATOR` configured for serialised history writes.
- Keep public and private asset buckets distinct; private Source/Output files use authorised routes.
- Configure at least one usable model provider. Check both platform and user-key access paths as applicable.
- Apply the current local or authorised remote migrations, including plan allowance seeding. Credits require positive `plans.included_credits`; missing allowances refuse new work. Read values from D1 and `/plans`, not copied defaults in prose.

Configure sign-in methods together with their callback URLs, passkey origins, email delivery, cookies and allowed origins. Captcha enforcement requires matching API `HCAPTCHA_SECRET_KEY`/`HCAPTCHA_SITE_KEY` and web `VITE_CAPTCHA_SITE_KEY`; omit or disable `REQUIRE_CAPTCHA_SECRET_KEY` when captcha is not offered.

## Optional capabilities

- **Embeddings:** use a separate stable `EMBEDDING_SCOPE_SECRET` of at least 32 characters. Rotation requires deliberate reindexing. Managed Vectorize needs its bindings; S3 Vectors needs complete bucket/index/region settings and the person's stored credential. Do not redirect historical vectors when credentials change. See [retrieval](architecture/decisions/0033-separate-embedding-runtime-and-retrieval-policy.md).
- **Connectors:** configure Composio's deployment namespace, key, signed webhook and private file bridge using the [connector guide](operations/composio-connectors.md).
- **Coding:** preserve API/sandbox service bindings and matching JWT authority. GitHub App credentials belong to the API; execution belongs in the [sandbox Worker](components/sandbox-worker.md).
- **Training:** share `TRAINING_WORKER_TOKEN` between API and training Worker, and provision only the AWS paths selected in the [training guide](components/training-worker.md).
- **Billing:** Stripe needs matching test/live keys, webhook secret and plan Price IDs. Configure overage separately; see [billing](operations/stripe-billing.md).
- **Guardrails:** Shieldstral uses a self-hosted compatible endpoint, not the Mistral model API. Configure its URL/key and keep policy/version server-owned. Use the example file and adapter for current options.
- **Other integrations:** enable analytics, messaging and media providers only when their credentials and runtime paths are ready. Leave omitted capabilities unavailable rather than inventing production values.

Keep local, preview and production resources and authority separate. Check origins, callbacks, cookies, CSP/CORS, webhooks and service bindings together after any environment change.
