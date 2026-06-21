# Agent Instructions

Start from the user's global agent contract. These instructions make that contract concrete for the application workspaces in this repo. If instructions conflict, follow the stricter, safer, and more maintainable rule.

## Principles

- Leave each app easier to understand than you found it.
- Prefer small, explicit changes over speculative abstractions.
- Keep feature internals out of route and page entry points.
- Fix types at the source. Do not cast around type errors to silence tooling.
- Add dependencies only when necessary and agreed. Use `pnpm` and commit lockfile changes with package changes.
- Comments should explain why. Use them sparingly for I/O boundaries, validation rules, security-sensitive behaviour, and edge cases.

## Structure

- Treat route files as orchestration layers for data loading, validation, and composition.
- Move non-trivial logic into dedicated modules immediately. This includes state machines, parsers, measurements, timers, multi-step validation, and code longer than roughly 25-40 lines.
- Put reusable helpers in shared modules under the app's `src/lib`, `src/utils`, or existing equivalent directory.
- Search for an existing helper before adding a new one.
- Do not define generic helpers inside feature files, route files, page files, service files, or tests unless the helper is test-only and local to that test.
- Generic helpers include serialisation, parsing, string, date, number, type guard, validator, formatter, mapper, and error utilities.
- If you introduce an inline helper during a task and it is generic, move it to a shared utility module in the same patch.

## Repository layout

- Use `apps/*` for deployable application workspaces. Each app owns its request handling, UI routes, app-local components, app-local utilities, and app-specific validation.
- Use `packages/*` for shared workspace libraries consumed by more than one app or by app and tooling code. Keep shared schemas, domain primitives, generated contract surfaces, and reusable runtime logic there when the code is not app-specific.
- Keep package APIs explicit and stable. Prefer exporting narrow functions, types, and schemas over leaking internal folder structure across workspaces.
- Build shared packages before validating consumers when the package emits build output. `@assistant/schemas` is a common prerequisite for app typechecks and builds.
- Use `docs/` for durable project documentation and supporting images. Keep implementation notes close to the code unless they explain cross-app architecture, workflows, or user-facing behaviour that must outlive a single patch.
- Use `CONTEXT.md` for durable architecture vocabulary, product concepts, module responsibilities, and cross-app seams that architecture reviews should inherit.
- Use `docs/adr/` for Architecture Decision Records. Record accepted decisions that are hard to reverse, surprising without context, or likely to be re-litigated later.
- Use `scripts/` for checked-in automation that is intentionally reused by package scripts, hooks, CI, or operators. Prefer package scripts for ordinary validation commands and keep shell scripts small, portable, and explicit about side effects.
- Do not add one-off scripts for work that can be handled by an existing package script, test, migration command, or local utility.

## App conventions

- Use `pnpm --filter <workspace> <script>` from the repo root for app-specific commands.
- Use root scripts for repo-wide checks only when the wider blast radius is justified. Prefer filtered workspace commands for focused changes.
- Cloudflare Worker apps live in `apps/api`, `apps/sandbox-worker`, and `apps/training`. Keep request handling, service logic, repository access, and shared utilities separated by the existing folder structure.
- React apps live in `apps/app` and `apps/metrics`. Keep pages/routes thin and move UI behaviour into components, hooks, state modules, or shared libraries.
- Preserve existing formatter and linter choices. Most app workspaces use `oxfmt`, `oxlint`, TypeScript, and Vitest.
- Use Vitest for unit and integration-style tests in apps and packages. Keep tests near the behaviour they cover and use existing workspace `vitest.config.ts` files instead of adding ad hoc config.
- Use Playwright only for browser end-to-end coverage that genuinely needs a running app. Follow the root `test:e2e` script and do not start dev servers outside the documented test flow unless the task explicitly requires live browser validation.
- Use Drizzle for API database schema and migrations. Update `apps/api/src/lib/database/schema.ts`, then use the `@assistant/api` database scripts such as `db:generate`, `db:up`, and `db:migrate:*`; do not hand-edit generated migrations.
- When touching generated Cloudflare types, Drizzle migrations, or other generated output, use the workspace scripts rather than hand-editing generated files.

## Security

- Treat OWASP Top 10 risks as active concerns.
- Fix insecure code you touch or clearly call out why it cannot be fixed in the same patch.
- Pay particular attention to command injection, XSS, SQL injection, auth bypass, unsafe redirects, exposed secrets, insecure defaults, and overly broad CORS or cookie settings.
- Validate and normalise data at app boundaries before passing it into services or persistence layers.

## Testing and validation

- New behaviour needs relevant coverage.
- Prefer integration-style tests that cover validation, state transitions, and error handling.
- Avoid tests that only prove language or framework behaviour.
- Cover edge cases and failure paths when changing parsing, auth, persistence, external API, or Worker boundary logic.
- Run the narrowest meaningful validation first, then broader checks when risk justifies it.
- If validation cannot run, state the blocker clearly.

## Documentation and communication

- Edit prose conservatively and preserve the original voice.
- Use imperative mood and lead with the problem before the solution.
- Keep paragraphs short and prefer bullets when they improve scanning.
- Use British English unless nearby project text uses another convention.
- Be concise, direct, and opinionated. Acknowledge trade-offs honestly.
- Before large implementations, read `CONTEXT.md` and the relevant ADRs under `docs/adr/` so new work respects existing architecture decisions.
- When a large implementation introduces or changes load-bearing concepts, module responsibilities, cross-app flows, provider seams, persistence seams, or frontend/backend ownership, update `CONTEXT.md` in the same patch.
- When a large implementation makes a durable architecture decision, add a short ADR under `docs/adr/` using the next sequential number. Prefer concise ADRs that explain the problem, decision, and trade-off.
- Do not create ADRs for routine implementation details, easy-to-reverse choices, or decisions already obvious from local code.

## Git and pull requests

- Never commit directly to `main`.
- Use short conventional commit messages.
- Do not push or open a pull request unless explicitly instructed in the active task.
- Pull request descriptions should be concise and should not list files changed.
- Use this pull request shape:
  - Short opening sentence describing the change.
  - Concrete context for the issue.
  - Bullets for major functional changes.
  - Brief mention of docs and tests when applicable.

## Definition of done

- The changed code follows the user's global contract and these app instructions.
- No structural violations remain in changed files.
- Relevant validation has run, or a blocker is stated explicitly.
- Residual risks, assumptions, and follow-ups are stated briefly.
