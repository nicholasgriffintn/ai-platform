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
   - Copy `apps/api/wrangler.jsonc.example` to `apps/api/wrangler.jsonc` when a local or deployment-specific API manifest is needed.
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

## Component-specific setup

Read the matching reference when selected:

- [Web application](components/web.md)
- [API Worker](components/api.md)
- [Sandbox worker](components/sandbox-worker.md)
- [Training worker](components/training-worker.md)
- [iOS application](components/ios.md)

Treat their architectural and behavioural detail as useful context, but use root and workspace `package.json` scripts as the command authority.
