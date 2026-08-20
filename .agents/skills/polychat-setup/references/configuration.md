# Configure Polychat

Configure the smallest viable capability set. The tracked examples define available variable names; Wrangler manifests define runtime bindings and resource relationships.

## Sources of truth

- API local secrets and optional providers: `apps/api/.dev.vars.example`
- API Cloudflare topology: `apps/api/wrangler.jsonc.example` and the active ignored `apps/api/wrangler.json`
- Web build-time values: `apps/app/.env*`, `apps/app/src/constants.ts`, and `apps/app/wrangler.jsonc`
- Sandbox secrets and bindings: `apps/sandbox-worker/.dev.vars.example` and `apps/sandbox-worker/wrangler.json`
- Training secrets and bindings: `apps/training/.dev.vars.example` and `apps/training/wrangler.json`

Never copy real secret values into tracked examples.

## Configure by capability

### Core web and API

Set matching `APP_BASE_URL` and `API_BASE_URL`, a strong `JWT_SECRET`, and the Cloudflare resources used by the API: D1, KV, R2, Vectorize, Analytics Engine, queues, and Durable Objects. Confirm the web API and WebSocket URLs point to the same API environment.

Select at least one usable model provider. Cloudflare Workers AI can be bound through Wrangler; external providers use the corresponding secret from the API example file. Do not promise a provider is available merely because its adapter exists.

### Authentication

Configure only the sign-in methods being offered. Check GitHub and Apple client identifiers, client secrets, callback URLs, magic-link email delivery, passkey origins, captcha settings, cookie domains, and allowed origins together. A domain change without matching provider callbacks produces a broken or insecure login flow.

### Assets and media

Configure public and private R2 buckets separately. Keep private Source and Output files behind authorised API routes. Review the web CSP when changing asset hosts or adding media providers.

### Connectors and recipes

Composio requires an API key, stable deployment namespace, signed webhook secret, API/app origins, and a private asset bucket for file bridging. Read [composio-connectors.md](operations/composio-connectors.md) before enabling it. Changing the namespace requires users to reconnect.

### Sandbox coding runs

Use the same JWT authority as the API and preserve the `POLYCHAT_API` service binding. GitHub App identifiers, private key, webhook secret, installation URL, and slug belong to the API environment. Keep repository execution isolated in the sandbox worker.

### Training

Use a shared `TRAINING_WORKER_TOKEN` in the API and training worker. Add AWS credentials, regions, roles, and buckets only for Bedrock or SageMaker paths the deployment supports. Read [training-worker.md](components/training-worker.md) before selecting provider paths.

### Billing, analytics, messaging, and safety

Treat Stripe, PostHog, Beacon, email, SMS, guardrails, and captcha as independent capabilities. Disable their user interface or runtime path when credentials are intentionally absent; do not fill placeholders with dummy production values.

## Configuration review

Before validation, check that:

- every selected feature has both its secret and binding dependencies;
- every omitted feature is hidden or fails clearly;
- local, preview, and production namespaces cannot share authority accidentally;
- public configuration contains no secrets;
- callback, webhook, CSP, CORS, cookie, asset, and service-binding URLs use the intended environment.
