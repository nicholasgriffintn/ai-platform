# End-to-end test structure

Use Playwright end-to-end tests as the release-validation suite for user-facing Polychat behaviour. Keep tests under `apps/app/tests/e2e` and write every browser interaction through a Page Object.

## Test boundary

Exercise the Polychat app and API together. The E2E runtime builds the API Worker, applies its migrations to an isolated D1 database, and seeds deterministic logged-out, Free, and Pro personas.

Mock only outbound third-party services at their boundary. Do not intercept or replace Polychat API routes in the browser. An unexpected outbound request must fail the test so new integrations cannot silently reach a live service.

## Release failures

Treat a failed user journey as release evidence, not a reason to reduce coverage.

- Keep the failing test enabled with its complete user outcome.
- Correct the test only when its Page Object, boundary, or expectation is demonstrably inaccurate.
- Do not delete or skip the journey, weaken the assertion, substitute an internal API mock, or alter fixtures to hide a product defect.
- Fix product behaviour only within the authorised task scope, then rerun the complete release suite.

## Page Object Model

Each Page Object extends `BasePage` and owns:

- Page-specific locators
- Browser interactions and multi-step workflows
- Waiting for user-visible completion states

Keep assertions in the feature spec when they describe the user outcome. Add or extend a Page Object instead of placing clicks, form entry, or navigation sequences directly in a spec.

```typescript
await homePage.navigate("/chat");
await homePage.selectModel("Compound Mini");
await homePage.sendMessage("Hello");
await homePage.waitForChatResponse(0);
await expect(homePage.getLatestAssistantMessage()).toContainText("E2E response:");
```

## Required coverage

Treat a user-facing feature as incomplete until its E2E impact has been considered. Cover the relevant state transitions, not static copy.

| Surface | Logged out | Free account | Pro account |
| --- | --- | --- | --- |
| Chat | Local history, messages, public navigation, sign-in entry | Local history, messages, account limits | Synced history, messages, attachments, sharing and branching |
| Work | Sign-in boundaries on overview and deep links | Pro entitlement and return to Chat | Workspaces, projects, members, governance, project chat and every project sub-surface |
| Account | Every profile tab is protected | Every profile tab loads with Free billing state | Every profile tab loads with Pro billing state |
| Configuration | Sign-in entry | AI and messaging provider lifecycles | Connectors, API keys, sources and Work configuration lifecycles |
| Recovery | Missing routes and unavailable shared links | Missing routes and unavailable shared links | Provider failures, missing resources and continued use after failure |

For messages, include representative plain text, multiline and Unicode, code and special characters, image, document/code, and audio inputs. Add another case when a new message or attachment type becomes user-facing.

For responsive behaviour, keep the full behavioural matrix on desktop Chromium and add focused mobile-width journeys for navigation and layout-sensitive controls. Add another browser only when a browser-specific product contract requires it.

## Keeping the suite fast

- Group closely related assertions into one journey per persona where isolation is not required.
- Run independent tests fully in parallel and provision one isolated identity per test.
- Use deterministic third-party responses with no fixed sleeps.
- Wait on accessible UI state or a completed workflow, not network idle.
- Run Chromium only by default and shard the full suite in CI.
- Retain traces, screenshots, and videos only for failures or retries.

## Running tests

Install Chromium once:

```bash
pnpm exec playwright install chromium
```

Run the complete release-validation suite:

```bash
pnpm test:e2e:release
```

Run the fast smoke suite:

```bash
pnpm test:e2e:smoke
```

Run a focused file or test name:

```bash
pnpm test:e2e apps/app/tests/e2e/features/chat.spec.ts
pnpm test:e2e --grep "provider failure"
```

The root `release:check` command includes the complete E2E suite. CI runs the same suite in two shards and uploads failure artefacts.
