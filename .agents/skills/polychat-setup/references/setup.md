# Set up local development

Run commands from the repository root with the same Node/pnpm toolchain already used by checkout.

## 1. Install and build schema packages

```sh
pnpm install
pnpm exec vp run --filter=@ngriffin_uk/polychat-schemas build
```

## 2. Create required local env files

- API: copy `.dev.vars.example` and `wrangler.jsonc.example` to `apps/api/.dev.vars` and `apps/api/wrangler.json`
- Optional workers: copy their `.dev.vars.example` files into `apps/sandbox-worker` and `apps/training` if those components are enabled.

## 3. Configure and migrate locally

```sh
pnpm --filter @assistant/api db:migrate:local
```

Use `db:seed:local` only when you explicitly want an empty seeded dataset replaced.

## 4. Start the correct surface

```sh
pnpm dev
```

Use `pnpm dev:api`, `pnpm dev:app`, or `pnpm dev:mobile` for targeted checks.
Stop any long-running process you start once validation is complete.

## Sign-in and fixtures

- Use the local magic-link flow; open the generated email file under `apps/api/.wrangler/tmp/email/`.
- Run native fixture refresh only when the requested surface needs it: `pnpm refresh:mobile-model-fixture`.

## Native setup

- iOS: open `apps/mobile/ios/Polychat.xcodeproj`, then run `pnpm dev:mobile`, `pnpm test:mobile`, or `pnpm build:mobile`.
- Desktop and training worker details are optional and documented where needed in the operations docs.
