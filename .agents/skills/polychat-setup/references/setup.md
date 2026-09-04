# Set up local development

Run commands from the repository root. Use the Node/pnpm toolchain declared by the checkout and configure Cloudflare access only for the selected components.

## Bootstrap

1. Run `pnpm install`, then build shared schemas:

   ```sh
   pnpm --filter @ngriffin_uk/polychat-schemas build
   ```

2. Create ignored local configuration from the tracked examples, without overwriting existing files:
   - API: `.dev.vars.example` → `.dev.vars` and `wrangler.jsonc.example` → `wrangler.json` under `apps/api`.
   - Optional Workers: copy their `.dev.vars.example` under `apps/sandbox-worker` or `apps/training`.
   - Keep the API manifest named `wrangler.json`; that deployment-specific filename is ignored.

3. Configure required bindings, origins and credentials using [configuration](configuration.md), then apply local migrations:

   ```sh
   pnpm --filter @assistant/api db:migrate:local
   ```

4. Run the relevant checks in root `AGENTS.md`. Start the app only when requested or runtime validation is necessary:

   ```sh
   pnpm dev
   ```

Use `pnpm dev:api`, `pnpm dev:app` or `pnpm dev:training` when only that component is needed. Stop any servers started for validation before finishing.

## Sign in locally

Request a magic link from the local sign-in form with a disposable email. The API development terminal prints the generated email text-file path under `apps/api/.wrangler/tmp/email/`; open its link in the same browser session. A non-browser request needs a browser User-Agent because unauthenticated bot requests are rejected.

Use the existing [E2E personas](testing/e2e.md) for deterministic Free and Pro journeys. Do not guess a local SQLite file or create a fixed reusable session cookie to bypass the sign-in flow.

## Native iOS

Open `apps/mobile/ios/Polychat.xcodeproj` in Xcode. Configure an available iPhone simulator and use `pnpm dev:mobile`, `pnpm test:mobile` or `pnpm build:mobile`; `scripts/xcodebuild-mobile.sh` owns the build details. Distribution additionally requires manual signing, archive and export in Xcode. Follow [white-labelling](white-labelling.md) for bundle identity and associated domains.

Optional Worker details live in [sandbox](components/sandbox-worker.md) and [training](components/training-worker.md).
