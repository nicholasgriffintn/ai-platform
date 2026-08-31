# Deploy Polychat

Deploy only the components selected during setup. Keep preview and production resources, secrets, namespaces, callback URLs, and provider accounts distinct.

## Prepare Cloudflare

Use the Wrangler manifests as the binding authority. Provision or select the required D1 databases, R2 buckets, KV namespaces, Vectorize index, Analytics Engine dataset, queues, Durable Objects, Worker services, routes, and custom domains before deploying code that expects them.

Replace every `REPLACE_ME` value in the deployment-specific API configuration. Confirm service bindings name the actual sandbox and training Workers. Do not commit a manifest containing secrets.

## Apply database migrations

Generate migrations only by changing the Drizzle schema and running the workspace generator. Apply only the intended target:

```sh
pnpm --filter @assistant/api db:migrate:local
pnpm --filter @assistant/api db:migrate:preview
pnpm --filter @assistant/api db:migrate:prod
```

Remote migrations are state-changing operations. Inspect the target and migration set, explain risk, and obtain explicit authority before applying preview or production migrations.

## Deploy in dependency order

1. Build and validate `@ngriffin_uk/polychat-schemas` and affected consumers.
2. Configure secrets and provision backing resources.
3. Apply required database migrations.
4. Deploy selected internal workers such as training and sandbox.
5. Deploy the API with service bindings pointing to those workers.
6. Deploy the web app against the intended API origin.
7. Configure external callbacks, webhooks, OAuth origins, DNS, email, analytics, billing, and Apple associated domains.
8. Run focused production smoke checks without exposing secrets or destructive provider actions.

Use the root scripts as the current command authority:

```sh
pnpm deploy:training
pnpm deploy:api
pnpm deploy:app
pnpm deploy
```

The root `deploy` script deploys the API and web app, not every optional worker.

## Connector operations

When deploying Composio, follow [composio-connectors.md](operations/composio-connectors.md). Its migration ordering, signed webhook, catalogue synchronisation, exact-action approval, private file bridge, rollback, and reconciliation rules are security requirements.

## Verify what shipped

`.agents/verification/pending/` holds the changes nobody has checked by hand yet. Read it before deploying: its prerequisites item names the migrations, secrets, and bindings that must exist first, and skipping one turns a working deploy into a broken product.

Work through the remaining items against the deployed product after step 8, then archive them as [verification.md](verification.md) describes. If the queue is empty but the tree has moved on, rebuild it from the last Cloudflare deployment rather than assuming there is nothing to check.

## Handoff

Record deployed component versions, resource names, domains, applied migrations, namespace choices, external callback state, and deliberately deferred capabilities. Never record secret values.
