# Metrics Overview

React + Vite dashboard visualising Analytics Engine data for Polychat usage and performance.

## Directory Highlights

- `src/App.tsx` – QueryClient provider and root component wiring analytics + dashboard.
- `src/routes/index.tsx` – Landing page with filter controls and data fetching logic.
- `src/components/` – Dashboard widgets, controls, layout primitives.
- `src/lib/utils.ts` – Shared helpers for formatting and query composition.
- `public/`, `dist/` – Static assets and build output (generated).
- `vite.config.ts`, `vitest.config.ts` – Build/test config (jsdom environment).

## Local Commands

- **Dev server**
  ```sh
  pnpm --filter @assistant/schemas build
  pnpm --filter @assistant/metrics dev
  ```
- **Build & deploy**
  ```sh
  pnpm --filter @assistant/metrics build
  pnpm --filter @assistant/metrics deploy
  ```
- **Quality**
  ```sh
  pnpm --filter @assistant/metrics lint
  pnpm --filter @assistant/metrics format
  pnpm --filter @assistant/metrics test
  ```

## Testing & Analytics

- Tests run in jsdom via Vitest; add setup in `src/test/setup.ts` if DOM globals are needed.
- Dashboard fetches the `/metrics` API; mock HTTP responses in tests to avoid live requests.
- `components/analytics.tsx` injects Beacon analytics; keep script URL and site ID in sync with production.

## Guardrails

- Avoid committing files under `dist/` or other generated artefacts.
- Maintain filter param validation before calling the API; backend enforces limits, but UI should guard user input.
- Respect rate limits by debouncing new fetches when adding dashboard interactions.
- Document any new analytics events or Beacon usage when modifying `Analytics` component.
