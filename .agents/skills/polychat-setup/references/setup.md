# Local development

Use Node.js 24 and the pnpm version pinned in the root `package.json`. Run commands from the repository root.

1. Install dependencies with `pnpm install`.
2. Create `apps/api/.dev.vars` from `apps/api/.dev.vars.example` if it does not already exist. Keep the tracked Wrangler manifest; do not replace it with the example manifest.
3. If you need a local worker, create its `.dev.vars` from the matching example in `apps/sandbox-worker` or `apps/agent-worker`.
4. Apply the local API migrations with `pnpm --filter @assistant/api db:migrate:local`.
5. Start the web app and API with `pnpm dev`. Use `pnpm dev:api` or `pnpm dev:app` for one surface, and `pnpm dev:mobile` for iOS.

Dev servers and tests resolve workspace packages from source. `pnpm install` builds the packages once, and `pnpm typecheck` keeps their declarations current through TypeScript project references. Run `pnpm dev:packages` to keep built outputs fresh while editing packages, `pnpm build:packages` for a one-off build, and `pnpm sync:references` after adding or removing a workspace dependency.

Magic-link sign-in sends email through the API's `SEND_EMAIL` binding. Configure it and `SES_EMAIL_FROM` for the local environment before relying on email sign-in.

Refresh the native model fixture with `pnpm refresh:mobile-model-fixture` only when a task needs current catalogue data. See [configuration](configuration.md) for bindings and [E2E checks](../../../../apps/app/tests/e2e/README.md) for browser journeys.
