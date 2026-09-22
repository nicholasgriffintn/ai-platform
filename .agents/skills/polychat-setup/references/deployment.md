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

## Manual Worker Previews

Use Worker Previews for remote manual testing. They are named environments under an existing Worker, not production deployments, and default to the current Git branch when `--name` is omitted.

1. Complete the Preview resource, hostname, Access and base-secret setup in the pending verification item.
2. Choose one stable Preview name and use it for every command in the session.
3. Apply migrations to the shared Preview D1 database when the change needs data. Coordinate this with other Preview users because every named Preview shares the database:

   ```sh
   pnpm --filter @assistant/api db:migrate:preview
   ```

   To replace all shared Preview data with the development fixture, stop parallel Preview builds and run the destructive seed command instead. It verifies the resolved D1 database name, drops every table, reapplies migrations and generates a random session credential without creating a long-lived API key. The session expires after 24 hours; treat the printed credential as a secret.

   ```sh
   pnpm --filter @assistant/api db:seed:preview --yes
   ```

4. Set the Preview-only origins in the ignored API manifest, then create only the Preview needed for the test:

   ```sh
   pnpm preview:api --name <preview-name>
   VITE_API_BASE_URL=https://<api-preview-origin> VITE_WS_API_URL=wss://<api-preview-host> VITE_WEB_APP_BASE_URL=https://<app-preview-origin> pnpm preview:app --name <preview-name>
   pnpm preview:sandbox --name <preview-name>
   pnpm preview:computer --name <preview-name>
   pnpm preview:training --name <preview-name>
   ```

   Sandbox and computer Previews retain non-routable `.invalid` host values by default. Override those Preview variables on an intentional custom-domain test; do not edit the tracked manifests for each run.

   Do not treat these as a deploy-all sequence. API and sandbox Previews intentionally omit service bindings because Cloudflare would route them to production Workers. A shared name does not connect separate Worker Previews.

5. Delete each created Preview when testing finishes:

   ```sh
   pnpm --filter <workspace> exec wrangler preview delete --name <preview-name>
   ```

For pull requests, use Cloudflare Workers Builds only for trusted contributors and branches because Preview code can read its runtime secrets. Keep the repository root as the build root, scope the build token to the Worker and Preview resources it needs, and set the Preview command to the relevant `pnpm preview:<worker>` command. Existing Builds integrations require an irreversible one-time switch from Version URLs to Worker Previews. Do not fan every change out to every Worker or run parallel API/training builds against the shared D1 database.

## Post-deploy

- Verify callbacks, DNS, webhook signatures, service bindings, and signing keys in the environment you just changed.
- Re-run relevant operations guides (billing/connectors/workers) for integration surfaces.
- Record versions, domains, migrations, and any remaining manual checks in `.agents/verification`.
