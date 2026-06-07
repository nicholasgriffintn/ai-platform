# Apps Agent Instructions

Scope: everything under `apps/`.

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

## App conventions

- Use `pnpm --filter <workspace> <script>` from the repo root for app-specific commands.
- Cloudflare Worker apps live in `apps/api`, `apps/sandbox-worker`, and `apps/training`. Keep request handling, service logic, repository access, and shared utilities separated by the existing folder structure.
- React apps live in `apps/app` and `apps/metrics`. Keep pages/routes thin and move UI behaviour into components, hooks, state modules, or shared libraries.
- Preserve existing formatter and linter choices. Most app workspaces use `oxfmt`, `oxlint`, TypeScript, and Vitest.
- When touching generated Cloudflare types or migration files, use the workspace scripts rather than hand-editing generated output.

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
