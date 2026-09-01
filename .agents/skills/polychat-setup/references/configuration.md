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

Set matching `APP_BASE_URL` and `API_BASE_URL`, a strong `JWT_SECRET`, and a separate stable
`EMBEDDING_SCOPE_SECRET` of at least 32 characters. The embedding secret derives opaque personal
scope tags and must remain stable across JWT rotations; changing it requires a deliberate vector
reindex. The same secret fingerprints user-owned S3 Vectors credentials. Rotating an S3 credential
makes its historical targets unavailable until the previous credential is restored or an operator
safely reconciles and reindexes them.

For managed embeddings, bind Workers AI and Vectorize when using Vectorize. When using S3 Vectors,
set the bucket, index, and region together and store the person's S3 credential; partial S3 settings
are rejected. Bedrock is not available for the managed document or built-in memory lifecycle.

Configure the Cloudflare resources used by the API: D1, KV, R2, Vectorize, Analytics Engine,
queues, and Durable Objects. Confirm the web API and WebSocket URLs point to the same API
environment.

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

Enable captcha enforcement with `REQUIRE_CAPTCHA_SECRET_KEY=true` only when the API has both
`HCAPTCHA_SECRET_KEY` and `HCAPTCHA_SITE_KEY`, and the web app uses the same site key through
`VITE_CAPTCHA_SITE_KEY`. Set the enforcement flag to `false` or omit it when captcha is disabled.
The API fails closed with a service-unavailable response if enforcement is enabled without the
required keys.

Stripe billing also needs a recurring Price for each paid plan and that Price ID stored on the matching
`plans.stripe_price_id` row in D1. Keep test Price IDs with test secret keys and live Price IDs with live
secret keys. A Stripe secret alone does not configure Checkout. Follow the
[Stripe billing runbook](operations/stripe-billing.md) for webhook events, local configuration, and
staff access.

Credits are the only metering currency, and they work without Stripe. Every plan, including the
anonymous allowance, falls back to `DEFAULT_PLAN_INCLUDED_CREDITS` in
`apps/api/src/lib/usage/planSeed.ts` (anonymous 15, free 150, pro 1500, enterprise 15000 per calendar
month); `plans.included_credits` overrides that default rather than enabling metering. `GET /plans`
serves the resulting allowances to the public pricing page, so never restate them in the client.

Stripe overage billing meters credits through Billing Meters rather than per-request charges. Without
Stripe, spend still meters and simply pauses at the end of the reserve; the billing portal and overage
controls hide themselves rather than erroring. To enable overage for a plan, do the dashboard work
first, then record the identifiers on the plan row:

- Create a Billing Meter in Stripe with an event name (for example `polychat_overage_credits`),
  the default customer mapping (`stripe_customer_id`) and the default value key (`value`).
- Create a recurring metered price on the subscription product that bills from that meter.
- Set the plan's columns through `PUT /admin/plans/:id/credits` (strict admin): `included_credits`,
  `grace_credits` (the reserve, defaulting to 10% of included with a 50-credit floor and a 50% cap),
  `stripe_meter_id` (the meter's **event name**) and `overage_price_id`. Leave the two Stripe columns
  null until the Stripe objects exist; a plan without `stripe_meter_id` is skipped by the hourly sync,
  and one without `overage_price_id` refuses the overage opt-in.

`APP_BASE_URL` must be set for checkout and the billing portal: `success_url`, `cancel_url` and
`return_url` are all validated against that origin, so a missing value rejects every redirect.

Shieldstral is an optional, self-hosted guardrail rather than a Mistral API model. Set
`SHIELDSTRAL_BASE_URL` to the root of an OpenAI-compatible vLLM, llama.cpp, or SGLang endpoint and
set `SHIELDSTRAL_API_KEY` when that endpoint requires bearer authentication. Pin the deployed
checkpoint with `SHIELDSTRAL_MODEL`; the default is `mistralai/Shieldstral-1.0-3B`.

Keep `SHIELDSTRAL_POLICY` server-owned and record policy changes through
`SHIELDSTRAL_POLICY_VERSION`. `SHIELDSTRAL_THRESHOLD` accepts a value from 0 to 1 and defaults to
`0.5`. Enabling Shieldstral without a valid endpoint fails closed rather than allowing unchecked
content.

## Configuration review

Before validation, check that:

- every selected feature has both its secret and binding dependencies;
- every omitted feature is hidden or fails clearly;
- local, preview, and production namespaces cannot share authority accidentally;
- public configuration contains no secrets;
- callback, webhook, CSP, CORS, cookie, asset, and service-binding URLs use the intended environment.
