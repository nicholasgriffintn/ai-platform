# Set up local development

Use this path for a new checkout. Run commands from the repository root unless a reference explicitly says otherwise.

## Prerequisites

- Node.js compatible with the checked-in toolchain.
- `pnpm`, as declared in the root `package.json`.
- A Cloudflare account and Wrangler authentication for Worker resources.
- Provider accounts only for capabilities the user elects to enable.
- Xcode for the optional iOS client.

## Select a scope

Recommend one of these scopes before asking for provider credentials:

- **Core local:** web app plus API. This is the default.
- **Coding:** core plus the sandbox worker and GitHub App integration.
- **Training:** core plus the training worker and AWS resources.
- **Full platform:** all components, Composio connectors, media providers, billing, analytics, and iOS.

Optional integrations should fail as unavailable rather than force a new adopter to configure every provider.

## Bootstrap the workspace

1. Install dependencies with `pnpm install`.
2. Build `@ngriffin_uk/polychat-schemas` before validating consumers that depend on its output:

   ```sh
   pnpm --filter @ngriffin_uk/polychat-schemas build
   ```

3. Create local, ignored configuration only for the selected components:

   - Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars`, then fill only required values.
   - Copy `apps/api/wrangler.jsonc.example` to `apps/api/wrangler.json` when a local or deployment-specific API manifest is needed. That filename is the one the repository ignores; `wrangler.jsonc` would be tracked and would commit account topology.
   - Copy `apps/sandbox-worker/.dev.vars.example` to `apps/sandbox-worker/.dev.vars` when enabling sandbox execution.
   - Copy `apps/training/.dev.vars.example` to `apps/training/.dev.vars` when enabling training.

   Do not overwrite an existing local file. Do not print or track its values.

4. Prepare the local D1 database when API persistence is required:

   ```sh
   pnpm --filter @assistant/api db:migrate:local
   ```

5. Run the focused checks in [validation.md](validation.md).

6. Start a development server only when the user asks to run the application or static checks cannot prove the required runtime behaviour. Use the documented scripts exactly:

   ```sh
   pnpm dev
   pnpm dev:api
   pnpm dev:app
   pnpm dev:training
   ```

## Sign in during local browser validation

Use the local magic-link delivery instead of requiring a real inbox or production authentication credentials:

- Enter any disposable email address in the local sign-in form.
- Read the API development terminal output for the generated email `.txt` file path. Wrangler prints it as `send_email binding called with MessageBuilder:` followed by `Text:` and `HTML:` paths under `apps/api/.wrangler/tmp/email/`.
- Open that file locally and visit the magic-link URL it contains in the same browser session.

Requesting a link outside a browser needs a browser `User-Agent`. The auth middleware runs a bot check on unauthenticated requests, so a default `curl` agent is rejected with `401 Bot access is not allowed` before the route runs:

```sh
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
curl -s -X POST http://localhost:8787/auth/magic-link/request \
  -H "Content-Type: application/json" -H "User-Agent: $UA" \
  -d '{"email":"local-dev@example.com"}'
```

Verify the token from the email file to receive a `session` cookie:

```sh
curl -s -i -X POST http://localhost:8787/auth/magic-link/verify \
  -H "Content-Type: application/json" -H "User-Agent: $UA" \
  -d '{"token":"<token from the email file>"}'
```

## Sign in as a specific existing user, including Pro

Magic link creates or resolves a user by email, so it cannot by itself put you on an existing account with a particular plan. To validate plan-gated behaviour, provision a session row for a user that already exists in the local database. The end-to-end harness uses this same mechanism, and the session id is the base64url SHA-256 of the cookie value:

```sh
DB=$(ls apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite | xargs ls -S | head -1)
sqlite3 "$DB" "SELECT id, email, plan_id FROM user ORDER BY id;"

TOKEN="local-dev-pro-session"
SID=$(printf '%s' "$TOKEN" | openssl dgst -sha256 -binary | openssl base64 -A | tr '+/' '-_' | tr -d '=')
EXPIRES=$(python3 -c "import datetime;print((datetime.datetime.now(datetime.UTC)+datetime.timedelta(days=30)).isoformat().replace('+00:00','Z'))")
sqlite3 "$DB" "INSERT OR REPLACE INTO session (id, user_id, expires_at) VALUES ('$SID', <user id>, '$EXPIRES');"
```

Then send `Cookie: session=local-dev-pro-session` on API requests, or set it in the browser before loading the app:

```js
document.cookie = "session=local-dev-pro-session; path=/; SameSite=Lax";
```

Delete the session row when validation finishes. Never point this at a remote database.

## Component-specific setup

Read the matching reference when selected:

- [Web application](components/web.md)
- [API Worker](components/api.md)
- [Sandbox worker](components/sandbox-worker.md)
- [Training worker](components/training-worker.md)
- [iOS application](components/ios.md)

Treat their architectural and behavioural detail as useful context, but use root and workspace `package.json` scripts as the command authority.
