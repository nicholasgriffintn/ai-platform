# Agent instructions

Polychat is a pnpm monorepo: Chat, Work, API, web, desktop, optional sandbox/training workers, and iOS.
Use [`polychat-setup`](.agents/skills/polychat-setup/SKILL.md) as setup/ops reference and keep the repository root `AGENTS.md` contract current.

## Boundaries

- Keep routes and page files orchestration-only. Move parsing, state machines, timers, retries, and durable logic into services, hooks, or shared libs.
- Keep shared helpers in shared utility modules (`src/lib`, `src/utils`); avoid duplicating generic utility logic in feature files.
- Keep wire contracts in `packages/schemas` and validate against all consumers.
- Keep API/package boundaries in place. Avoid coupling `component-*` packages to routers, stores, or API clients except `component-shell`.
- Keep authority checks at I/O boundaries. Verify personal vs project scope, reversibility, and owner permissions on every boundary.
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

Run these before every commit:

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
