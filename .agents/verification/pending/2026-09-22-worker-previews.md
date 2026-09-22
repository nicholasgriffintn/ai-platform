# Cloudflare Worker Previews

- **Change:** Manual remote Worker testing now uses Cloudflare Worker Previews with isolated Preview configuration and named clean-up.
- **Surfaces:** web, API, sandbox Worker, computer Worker and training Worker.
- **Prerequisites:** Wrangler authentication, dedicated Cloudflare resources and Preview base secrets. Workers Builds setup is optional.
- **Risk if wrong:** a Preview may fail to start, expose shared test credentials or data, or reach a production dependency if an operator adds a production service binding.
- **Commits:** record the merged commit or pull request before verification.

## Operator setup

- [ ] Create dedicated Preview resources: `personal-assistant-preview` D1, `assistant-assets-preview` and `assistant-private-assets-preview` R2 buckets, a Preview KV namespace, and the `polychat-preview` Vectorize index. Treat these and the Preview Analytics dataset as shared across all named Previews; store no PII.
- [ ] Copy the new `previews` block from `apps/api/wrangler.jsonc.example` into the ignored `apps/api/wrangler.json`, replace every placeholder, and keep services, queues, email and Flagship bindings absent.
- [ ] Copy `apps/api/wrangler.preview-migrations.jsonc.example` to `apps/api/wrangler.preview-migrations.jsonc`, then set the Preview D1 database ID.
- [ ] Copy `apps/training/wrangler.jsonc.example` to the ignored `apps/training/wrangler.json`, then set the production and Preview D1 database IDs.
- [ ] Replace the Preview origin placeholders in the ignored API manifest. Keep the tracked sandbox and computer `.invalid` defaults unless an isolated custom-domain test explicitly overrides them at the command line.
- [ ] In each applicable Worker, open **Settings**, select **Previews Base** under **Variables and secrets**, and add only dedicated, low-privilege, spend-capped non-production secrets. Preview branch code can read these values. The CLI equivalent is `pnpm --filter <workspace> exec wrangler preview base-config secret bulk <ignored-env-file>`.
- [ ] In each Worker, open **Domains → Worker URL** and enable **Preview**. The checked-in `preview_urls: true` setting will preserve this on the next authorised production deployment. Alternatively, add a dedicated custom domain enabled for Preview traffic.
- [ ] Protect app and API Preview hostnames with Cloudflare Access before seeding the remote database. Use hostname-based Access for WebSocket testing: Worker-level `preview_worker` protection does not support WebSockets. Permit an unprotected, time-bounded exception only for an unseeded smoke test with no secrets or data, and remove it immediately afterwards.
- [ ] If a Worker uses Workers Builds, open **Settings → Builds**. Enable **Preview Builds** only for trusted contributors and branches, keep the repository root as its root directory, scope its build token to the required Worker and Preview resources, and set the Preview command to the relevant `pnpm preview:<worker>` command. Do not run API or training pull-request builds in parallel against the shared D1 database. For an existing Builds integration, review the **Set up Worker Previews** prompt and confirm the irreversible switch from the legacy production-resource preview model.

## Verify

- [ ] Run `pnpm preview:api --name manual-worker-preview`, open the returned URL, and confirm `/status?detailed=true` reports `environment: "preview"` with healthy Preview D1 and KV checks.
- [ ] Run `pnpm --filter @assistant/api db:seed:preview` and confirm it refuses the destructive reset without `--yes`. With no other seed or API/training Preview build running, rerun it with `--yes`; confirm it resolves only `personal-assistant-preview`, prints a new random session credential with an expiry 24 hours ahead, and does not create a long-lived API key. Do not paste the session into logs or the verification record.
- [ ] Build the app with its API, WebSocket and web origins set to the named Preview URLs, then run `pnpm preview:app --name manual-worker-preview`. Confirm the API returns `Access-Control-Allow-Origin` for that exact app origin and omits it for an unrelated origin.
- [ ] Create one container-backed Preview and confirm Cloudflare creates a Preview-specific Durable Object namespace and container application. Do not exercise a path that requires the omitted production service binding.
- [ ] Run `pnpm --filter <workspace> exec wrangler preview delete --name manual-worker-preview` for every created Worker and confirm the Preview URLs stop responding. For sandbox and computer Previews, run `pnpm --filter <workspace> exec wrangler containers list`, review any application whose name includes the Worker and Preview name, and delete only that application with `pnpm --filter <workspace> exec wrangler containers delete <application-id>` if Cloudflare left it behind.
- [ ] Confirm pull requests receive the expected Cloudflare Preview status/comment when Workers Builds is enabled.

**Stop and report if:** any Preview can read or mutate a production D1, KV, R2 or Vectorize resource; any service binding targets a production Worker; a queue consumer or cron is expected to run; or the container application cannot be removed safely.
