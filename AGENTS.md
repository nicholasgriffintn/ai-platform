# Agent instructions

Polychat is a pnpm monorepo: Chat, Work, API, web, desktop, optional sandbox/training workers, and iOS.
Use [`polychat-setup`](.agents/skills/polychat-setup/SKILL.md) as setup/ops reference and keep the repository root `AGENTS.md` contract current.

## Boundaries

- Keep routes and page files orchestration-only. Move parsing, state machines, timers, retries, and durable logic into services, hooks, or shared libs.
- Reuse shared helpers from `packages/utility-core` and `packages/utility-server`. Keep domain logic in its owning module; do not introduce API `lib` or `utils` catch-all directories.
- Keep wire contracts in `packages/schemas` and validate against all consumers.
- Keep API/package boundaries in place. Avoid coupling `component-*` packages to routers, stores, or API clients except `component-shell`.
- Keep authority checks at I/O boundaries. Verify personal vs project scope, reversibility, and owner permissions on every boundary.
- Use `packages/library-policy` for Cedar authorisation decisions. Load current trusted facts in the owning module and keep signatures, tenant filters, lease fences and atomic grant consumption at their existing boundaries. Follow [the policy package README](packages/library-policy/README.md) when adding actions or governance rules.
- Keep documentation in application/package READMEs and the `polychat-setup` skill references. Do not add standalone documentation under `docs`.
- Keep hosted browser sessions bound to their creator and credential source. Send sign-in values only through dedicated approval events outside model input and stored tool output.
- Use `pnpm` for dependency updates and lockfile updates only when necessary.

## Operational limits

- Do not run git/PR commands unless requested by the user.
- Use remote migrations only with explicit user authority; do not run remote writes as routine validation.
- Deploy commands publish to production only when explicitly requested.
- Avoid local/dev server startup unless required for runtime validation.
- Never copy or echo ignored secrets into chat, commands, or tracked files.

## Models and providers

- Register model/provider icons through `packages/component-models/src/ModelIcon` using the documented icon registries.
- Use model patterns as lowercase substring matches; provider keys are exact lowercase IDs (including aliases).

## Validation

Do not add integration tests unless the user explicitly requests integration tests. Requests to build, fix, review or validate functionality do not authorise them. Do not add database runtimes, migration suites, service harnesses or fixtures solely to support integration tests, or move or rename integration tests to bypass this rule.

Add tests only when they protect observable behaviour, a meaningful invariant, or a real regression. Do not add catalogue field snapshots or trivial rendering assertions that merely restate the implementation.

Prefer unit tests for logic tests, do not over use them for cases where they are not useful such as the items listed above but also for ui, often unit tests are not really testing anything in these cases and just slow down development and CI.

Do not add integration tests unless the user explicitly requests integration tests. Requests to build, fix, review or validate functionality do not authorise them. Do not add database runtimes, migration suites, service harnesses or fixtures solely to support integration tests, or move or rename integration tests to bypass this rule.

Prefer using E2E tests to validate user journeys with direct api integrations vs integration tests or sloppy component unit tests but don't over do them, be cautious that adding new tests always slows down development and ci.

Run these before committing code changes. For deletion-only or documentation-only changes, verify references or formatting as appropriate; do not run the full checks solely to make a commit:

```sh
pnpm typecheck
pnpm check
```

Use narrower checks for iteration, then finish with the full pair above.

## Completion format

When you close a change, include:

- `Compliance:` whether the task met this contract
- `Validation:` commands run and result
- `Residual risks:` concise list or `none`
