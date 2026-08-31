# Deploy prerequisites for the 2026-08-31 release

- **Change:** Nine D1 migrations, one new secret, one new Durable Object, and an optional guardrails provider landed since the last deployment. Two migrations move data and one drops columns.
- **Surfaces:** API, web, iOS
- **Prerequisites:** this item is the prerequisite. Work through it before anything else in this queue.
- **Risk if wrong:** a deploy without these bindings and migrations fails closed on realtime sessions, embeddings, agents, and skills — all at once, in production.
- **Commits:** `1686ccfe`..`da78d8ac`

## Verify

- [ ] Read the nine new migrations under `apps/api/migrations/` (`0006`–`0014`) before applying anything. `0009` and `0012` are backfills and `0014` is destructive.
- [ ] Confirm `0014_gigantic_vapor` is acceptable: it drops `team_id`, `team_role` and `is_team_agent` from `agents` and no re-run undoes it. See `2026-08-31-team-agents-retired.md` for what that removes.
- [ ] Confirm `0009_backfill_scoped_embeddings` is acceptable: legacy embedding rows whose user and namespace do not independently agree stay inaccessible rather than regaining the old fallback. See `2026-08-31-embedding-lifecycle.md`.
- [ ] Take a D1 export, or note the restore point you would use, before applying to production.
- [ ] Set `EMBEDDING_SCOPE_SECRET` as an API Worker secret: at least 32 characters, random, and stable forever. Changing it later invalidates every scope tag derived from it.
- [ ] Add the `REALTIME_PROXY_COORDINATOR` Durable Object binding for class `RealtimeProxyCoordinator`, with the `v3` `new_sqlite_classes` migration tag, to the real `apps/api/wrangler.jsonc`. Only the example manifest is tracked; `git diff 1686ccfe..HEAD -- apps/api/wrangler.jsonc.example` shows the shape.
- [ ] Decide on Shieldstral. Leaving `SHIELDSTRAL_BASE_URL` unset leaves the provider unconfigured; setting it turns on a guardrails path. See `2026-08-31-shieldstral-guardrails.md`.
- [ ] Apply migrations to preview first, work the queue against preview, then apply to production: `pnpm --filter @assistant/api db:migrate:preview`, then `db:migrate:prod`.
- [ ] Deploy in order: `pnpm build:packages`, then `pnpm deploy:api`, then `pnpm deploy:app`. The API must be live first, because the web app now reads catalogues the API owns.
- [ ] Build and ship iOS separately. Several items in this queue need an app build, not a Worker deploy.

**Stop and report if:** a migration fails partway, or the API deploy reports a missing binding. Do not deploy the web app against an API that failed to start.

## Scope of this queue

The queue was rebuilt from the deployment boundary rather than written as the work happened. Cloudflare last deployed the API at `2026-08-31T05:28:50Z` and the web app at `2026-08-31T05:30:21Z`; the commit current at that point was `1686ccfe`. That mapping assumes the deploy ran from a clean tree at the tip — correct it if you know otherwise.

77 commits landed since. 20 were dependency bumps or lockfile maintenance, and the rest that produced no item were test-only, lint-only, or internal refactors with no behaviour a person could observe. The remaining changes are grouped into the other items in this directory by outcome, not by pull request.
