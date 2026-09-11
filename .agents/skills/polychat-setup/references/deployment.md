# Deploy Polychat

Deployment requires explicit authority and environment separation.

## Prepare

1. Confirm manifests, namespaces, and pending verification items.
2. Run required shared checks from `AGENTS.md`.
3. Choose target migration:
   - preview: `pnpm --filter @assistant/api db:migrate:preview`
   - production: `pnpm --filter @assistant/api db:migrate:prod`

## Deploy order

1. Deploy selected workers first (`deploy:training`, `@assistant/sandbox-worker deploy`) when enabled.
2. Deploy API.
3. Deploy web/app.

`pnpm deploy` covers API and app only; use direct commands for explicit scopes.

## Post-deploy

- Verify callbacks, DNS, webhook signatures, service bindings, and signing keys in the environment you just changed.
- Re-run relevant operations guides (billing/connectors/workers) for integration surfaces.
- Record versions, domains, migrations, and any remaining manual checks in `.agents/verification`.
