# App Overview
React Router 7 PWA for Polychat with offline storage, dynamic apps, and WebLLM support.

## Directory Highlights
- `src/root.tsx` – App shell, providers, error boundary, dev tools toggle.
- `src/pages/` – Route-based components mapped by React Router file convention.
- `src/components/` – Shared UI, shell, analytics, and captcha integrations.
- `src/lib/api/` – Fetch wrappers, auth helpers, and API service clients.
- `src/state/` – Zustand stores and React contexts for UI, usage, captcha.
- `src/lib/local/` & `src/lib/web-llm.ts` – Offline/local AI services.
- `public/` – Static assets; `build/` & `dist/` are generated via react-router build.
- `react-router.config.ts` – Router build configuration.

## Local Commands
- **Dev server (after schema build)**
  ```sh
  pnpm --filter @assistant/schemas build
  pnpm --filter @assistant/app dev
  ```
- **Build & deploy**
  ```sh
  pnpm --filter @assistant/app build
  pnpm --filter @assistant/app deploy
  ```
- **Type checking & linting**
  ```sh
  pnpm --filter @assistant/app typecheck
  pnpm --filter @assistant/app lint
  pnpm --filter @assistant/app format
  ```
- **Tests**
  ```sh
  pnpm --filter @assistant/app test         # Vitest (jsdom)
  pnpm --filter @assistant/app coverage
  pnpm test:e2e                             # Playwright (root command)
  ```

## Implementation Notes
- `apps/app/src/constants.ts` defines CSP, analytics, API endpoints, and feature flags; update carefully to avoid production regressions.
- Fetch calls must use `lib/api/fetch-wrapper.ts` to ensure CSRF headers and credentials are applied.
- Offline storage flows depend on IndexedDB utilities in `lib/local`; ensure new features degrade gracefully without local persistence.
- WebLLM manager (`lib/web-llm.ts`) maintains singleton state—avoid parallel instantiation.

## Guardrails
- Do not edit generated build artifacts under `build/` or `dist/`.
- Keep React Router data APIs aligned with backend contracts; update shared schemas first when API signatures change.
- Maintain accessibility in new components (Radix UI patterns, keyboard focus).
- When introducing new environment variables, prefix with `VITE_` and document in constants.
- E2E tests assume base URL `http://localhost:5173`; update Playwright config if ports change.
