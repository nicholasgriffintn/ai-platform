# Deploy Polychat

Deployment and remote migrations require explicit authority. Keep preview and production resources, credentials, callbacks and namespaces distinct.

## Prepare and deploy

1. Read `.agents/verification/pending/` for prerequisites. Inspect the active manifests and current migration set; replace deployment placeholders and provision required resources.
2. Build shared packages and validate affected consumers using root `AGENTS.md`. Confirm private buckets and service bindings target the intended environment.
3. Apply only the authorised database target with `pnpm --filter @assistant/api db:migrate:preview` or `db:migrate:prod`. Both are remote writes; `db:migrate:local` is not a deployment step.
4. Deploy selected internal Workers, then API, then web. Use `pnpm deploy:training`, `pnpm --filter @assistant/sandbox-worker deploy`, `pnpm deploy:api` and `pnpm deploy:app` as applicable. Root `pnpm deploy` covers API and web only.
5. Confirm external callbacks, webhooks, origins, DNS and signing configuration. Follow the relevant connector, billing or training guide when those systems are enabled.
6. Work through pending verification against the deployed product and preserve unchecked or failed items as [verification](verification.md) describes.

Record deployed versions, resource names, domains, migrations and remaining external actions, never secret values. If the verification queue is empty despite intervening changes, reconstruct it from the deployment boundary before treating the release as checked.
