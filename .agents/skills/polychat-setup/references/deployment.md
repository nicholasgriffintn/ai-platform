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

Lean Proofs adds generated project-task migrations for `sandbox_run_id`, `output_id`, `projection_claim_id`, and `idempotency_key`, plus unique indexes for run, output, and creator-scoped request identity. Apply migrations 0007 through 0009 in order before exposing its API routes; do not hand-edit or skip the generated snapshots.

## Provision Lean Proofs

Lean Proofs requires the sandbox Worker manifest's `LeanSandbox` Durable Object and its dedicated `standard-3` container built from `apps/sandbox-worker/Dockerfile.lean`. Keep the generic `Sandbox` binding on its existing basic container. Deploy the sandbox Worker before the API and web consumers that advertise the experience.

The Lean image pins the Cloudflare base by digest, verifies the uv and elan downloads, and installs `lean-lsp-mcp` from the hash-locked `container/lean-lsp-mcp.requirements.txt`. Regenerate that lock from `container/lean-lsp-mcp.in` when upgrading the adapter. The checked-in repository still chooses its own Lean toolchain and Lake dependencies, so a repository's first run needs outbound package access and may be materially slower than a warm run. Lean proof execution is capped at 55 minutes so API and GitHub credentials retain renewal margin. Monitor standard-3 container spend, queue concurrency, first-run download failures, and timeouts; local Loogle and Lean REPL remain disabled.

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

## Handoff

Record deployed component versions, resource names, domains, applied migrations, namespace choices, external callback state, and deliberately deferred capabilities. Never record secret values.
