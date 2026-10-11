# End-to-end checks

Playwright specs live under `apps/app/tests/e2e`. The root `playwright.config.ts` starts the test API and app; run commands from the repository root.

- `pnpm test:e2e` runs the full browser suite.
- `pnpm test:e2e:release` runs journeys tagged `@release`.
- `pnpm test:e2e:smoke` runs the core smoke journeys.
- `pnpm test:e2e:visual` runs the smoke journeys with `PVC_ENVIRONMENT=release`. The visual reporter is enabled only when both `PVC_ENVIRONMENT` and `PVC_TOKEN` are set.
- `pnpm build:e2e` builds packages and the app for browser tests; `pnpm typecheck:e2e` checks the Playwright files.

Mock outbound third-party services at their network boundary. Keep Polychat routes and the API real so tests cover the user journey and authorization behaviour.
