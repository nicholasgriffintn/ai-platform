# End-to-end verification

Use Playwright to exercise the real web app and API together with isolated D1 data and deterministic logged-out, Free and Pro personas. Keep browser interactions in Page Objects under `apps/app/tests/e2e`; specs assert user outcomes.

Mock only outbound third-party services, never Polychat routes. Unexpected external calls fail the test. Use the existing fixtures, including `test.use({ billing })` and `billingState`, for per-identity credit state. Disable external telemetry and captcha in the E2E build.

## Preserve release journeys

| Surface             | Behaviour to preserve                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| Chat                | Messages, local/synced history, attachments, sharing, branching and sign-in boundaries |
| Work                | Entitlement, workspaces, projects, members, governance, project chat and sub-surfaces  |
| Live                | Entry, muted session and cleanup for an eligible account                               |
| Account and billing | Protected tabs, plan state, credit reserve/exhaustion, overage and ledger              |
| Configuration       | Provider, connector, key and source lifecycles in their permitted scopes               |
| Recovery            | Provider failure, missing resources and continued use after failure                    |
| Responsive          | Navigation and layout-sensitive controls at mobile widths                              |

Keep representative text, Unicode, code, image, document and audio inputs. Test relevant transitions rather than static copy. A failed journey is product evidence: do not skip it, weaken its outcome, mock an internal route or alter fixtures to hide the defect.

Use one isolated identity per independent test, deterministic responses and observable waits rather than fixed sleeps. Desktop Chromium carries the full matrix; mobile-width tests focus on layout-sensitive journeys.

## Run

These commands launch the test runtime. Keep ports 8787 and 5173 free and build the E2E app first:

```sh
pnpm exec playwright install chromium
pnpm build:e2e
pnpm test:e2e:release
```

Use `pnpm test:e2e:smoke` for the compact logged-out, Free and Pro app/API journeys, or `pnpm test:e2e <spec-path>` for a focused change. `playwright.config.ts` owns runtime startup; do not start alternate servers or reuse a live development database. Root `release:check` is broad release validation, not the default feedback loop.
