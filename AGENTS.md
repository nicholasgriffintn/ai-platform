# Agent instructions

Polychat is a pnpm monorepo: personal **Chat**, collaborative **Work**, a Hono API on Cloudflare Workers, React Router web, native iOS, and optional sandbox and training Workers.

Read [architecture context](.agents/skills/polychat-setup/references/architecture/context.md) for cross-app work. Use [polychat-setup](.agents/skills/polychat-setup/SKILL.md) for setup, deployment and operational guidance. Follow the user's instructions over these repository defaults.

## Boundaries

- Keep routes and pages as orchestration. Extract parsing, state machines, timers, retries and substantial logic into existing services, hooks or libraries.
- Search before adding helpers. Put generic utilities in shared `src/lib` or `src/utils` modules, not feature, route, service or test files. Fix types at their source; do not cast around errors.
- Keep wire contracts in `packages/schemas`; build it before validating consumers. Consider API, web, iOS, sandbox and training consumers when a contract changes.
- Keep `component-*` packages independent of routers, stores and API clients. Hosts provide data and typed actions. Extract a package only when another consumer exists.
- Authorise Work through current server-side workspace membership. Project IDs and creator fields are not proof of access. Keep configuration, enablement and execution authority separate.
- Cover personal and project scope, reverse operations and failure states. Enforce validation and security at actual I/O boundaries; fix insecure code touched or state the limitation.
- Generate database changes from `apps/api/src/lib/database/schema.ts` with `db:generate`; use `cf-typegen` for Cloudflare types. Never hand-edit generated output.
- Add dependencies only when necessary and agreed, using pnpm and its lockfile. Reserve `scripts/` for reusable automation.

## Operational limits

- Do not run git or PR commands unless asked. Keep the shared checkout's branch unchanged; use a dedicated worktree for task branches. Use the configured bot identity, short conventional commits, and obtain authority before rewriting state or merging.
- Deploy scripts publish live Workers. Use them only when deployment is requested, never as build checks.
- Only `db:migrate:local` is safe unprompted. Preview and production migrations use `--remote` and require explicit authority.
- Treat `models:sync`, `connectors:sync`, remote database sync and remote studio operations as external actions. `db:studio:local` is local.
- Never print or copy secrets from ignored configuration into chat or tracked files. Use example files for variable names.
- Do not start dev servers for routine validation. When runtime validation is necessary, explain why, use the documented command, and stop the server before finishing. If startup fails, report it instead of inventing alternate ports or flags.

## Models and providers

Add model/provider icons through `packages/component-models/src/ModelIcon`: reuse artwork where possible, otherwise source it from svgl and register it in `Icons/`, `iconLoaders.ts` and `iconDefinitions.ts`. Model patterns are lowercase substrings, longer matches first; provider keys are exact lowercase IDs, including aliases.

## Validation

Run the narrowest relevant checks. Root `check`, `typecheck`, `test` and `release:check` are broad CI workflows.

```sh
pnpm --filter @ngriffin_uk/polychat-schemas build
pnpm --filter @assistant/api typecheck
pnpm --filter @assistant/app typecheck
pnpm --filter @assistant/app check
pnpm --filter @assistant/api test <path>
pnpm exec oxlint <changed dirs>
pnpm exec oxfmt --check <changed dirs>
```

Only `@assistant/app` has a workspace `check` script. Other workspaces use root oxlint/oxfmt and their own typecheck/tests. Model catalogue files are excluded from lint/format; preserve their conventions and typecheck them. Use `pnpm test:mobile` for iOS.

Add tests for observable behaviour, authority, validation, persistence, state transitions or real regressions. Extend nearby suites; avoid tests of static copy, CSS, delegation or framework guarantees. Use existing Vitest configuration. Preserve complete Playwright journeys and mock only outbound third parties; follow [E2E guidance](.agents/skills/polychat-setup/references/testing/e2e.md).

For documentation-only edits, check local links, referenced commands and deleted paths. No dev server or application test suite is needed.

## Completion

Keep prose concise and in British English. Document durable behaviour in the setup references, vocabulary and module ownership in architecture context, and consequential trade-offs in an ADR. Do not turn those files into changelogs or duplicate code catalogues.

Record behaviour requiring human or operator checks in [verification](.agents/skills/polychat-setup/references/verification.md); documentation-only edits need no item. Report affected surfaces, validation or blockers, and residual risks. Include `Compliance:`, `Validation:` and `Residual risks:` in the final response.
