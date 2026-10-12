# Configuration

Use the tracked Wrangler manifests as the source of truth for runtime bindings:

- `apps/api/wrangler.json` defines the API's D1 databases, R2 buckets, Workers AI, Vectorize, email, feature flags, worker loader, service bindings and Durable Objects.
- `apps/sandbox-worker/wrangler.json` and `apps/computer-worker/wrangler.jsonc` define worker-specific bindings and runtime settings.
- Keep local secrets in each app's ignored `.dev.vars` file. Start from the matching `.dev.vars.example`; never copy real values into tracked files.

The API calls the sandbox and computer workers through the `SANDBOX_WORKER` and `COMPUTER_WORKER` service bindings. Configure `JWT_SECRET` consistently where the API and sandbox worker verify the same internal requests. Email sign-in uses the API's `SEND_EMAIL` binding and `SES_EMAIL_FROM` setting.

Run local API migrations with `pnpm --filter @assistant/api db:migrate:local`. Use the API package scripts for preview or production migrations; remote migrations require explicit authority.
