# Agent Instructions

Polychat is a multi-model assistant platform: personal **Chat**, collaborative **Work**, and the capabilities behind both — agents, retrieval, generated media, realtime sessions, recipes, training, and sandboxed coding runs. It runs on Cloudflare Workers with D1, R2, and Durable Objects, and ships web, iOS, and API surfaces from one pnpm monorepo.

These are good defaults, not law. They make repo-specific behaviour predictable; they do not override the user's global contract, and the user's stated preference overrides both. If a rule fights the task in front of you, say so plainly and get sign-off rather than following it into a worse change. Prefer the smallest change that makes the correct behaviour obvious. Do not preserve complexity because it is already there, and do not add machinery because it looks thorough.

## Vocabulary

`.agents/skills/polychat-setup/references/` holds the durable product, setup, component, and architecture documentation, and is written as `references/` below. `references/architecture/context.md` carries the full vocabulary and seam map; read it before any large implementation. These terms collide most often:

- **app** — `apps/*` is a deployable workspace. An _app_ in product language is a capability presented in a project library or Chat discovery, never a top-level route.
- **capability** — an app, recipe, skill, connector, agent, or tool that a project curates or a person already has. Configuration is not enablement, and enablement is not authorisation.
- **experience** — a rich frontend workflow published by `/capabilities`, living below the project rather than beside it.
- **scope** — personal or project. It is a parameter to one set of components, not a fork of them.
- **source / output** — durable inputs and results. Personal without a project, collaborative with one.
- **Chat / Work** — product modes that share the conversation runtime and split navigation, not the reverse.

## Ways to hurt yourself

- **Applying migrations beyond local.** `db:migrate:prod` and `db:migrate:preview` run `wrangler d1 migrations apply --remote` against real D1. Only `db:migrate:local` is safe unprompted. Generate migrations freely; never apply them remotely.
- **Deploying.** `deploy`, `deploy:api`, `deploy:app`, and `deploy:training` publish live Workers. Never run one unless asked, and never to prove the build works — use the workspace `build` script for that.
- **Writing to external state.** `models:sync`, `connectors:sync`, `db:sync:preview`, and `db:studio:*` reach live provider, Composio, and database state. Treat them as production writes.
- **Reaching for repo-wide checks.** Root `typecheck` builds every package and then typechecks every workspace serially; `check`, `test`, and `release:check` are similarly wide. They are CI-shaped commands, not a feedback loop.
- **Running git.** Do not run any git or pull request command unless asked. When asked to commit, use short conventional messages.

## Hit every surface

The most common defect here is a change that is correct on the path you edited and missing everywhere else. Before calling work done, say which of these applied:

- **Deployables.** `apps/api` (Hono Worker), `apps/app` (React Router web), `apps/mobile` (Swift iOS), `apps/sandbox-worker`, `apps/training`. A shared concept needs a decision per surface, even when the decision is "not applicable here".
- **The contract seam.** Anything crossing the wire is typed in `packages/schemas` and published as `@ngriffin_uk/polychat-schemas`. Change the schema and the API, web, iOS, sandbox, and training consumers follow. Build the package before validating consumers.
- **Presentation packages.** `packages/component-*` render data and emit typed intents; they never import a router, store, or API client. `apps/app` owns the controllers that bind them.
- **Both scopes.** Personal and project scope share components, so a capability change usually lands in Chat and Work together.
- **Reverse states.** If you added a way in, add the way out and the way to see it. Enable needs disable, invite needs revoke. A one-way door is a bug.
- **Docs.** Behaviour a user would notice belongs in `references/`. New load-bearing vocabulary, module responsibilities, or cross-app seams belong in `references/architecture/context.md` in the same patch. A durable, hard-to-reverse, or likely-to-be-relitigated decision belongs in a numbered ADR under `references/architecture/decisions/` with `decisions.md` updated — not routine implementation details or choices obvious from local code.
- **Verification.** Behaviour a person has to check by hand belongs in a `.agents/verification/pending/` item in the same patch: what changed, what an operator must do first, and the steps to confirm it. Static checks do not cover it, and the person deploying did not watch you work. Follow `references/verification.md`.

### Models, providers, and icons

`packages/component-models/src/ModelIcon` owns every model and provider icon, and is part of done whenever you add a model under `apps/api/src/data-model/models/*` or register a provider in `apps/api/src/lib/providers/registry/registrations/*`. Without a match the surface falls back to a coloured initial, which reads as a bug.

- Source artwork from svgl first: search `https://api.svgl.app?search=<brand>`, then fetch `https://api.svgl.app/svg/<name>.svg`. Hand-draw only when svgl has no entry, and keep it simple rather than imitating a trademark you cannot verify.
- Add `Icons/<name>.tsx` following the existing component shape, register it in `iconLoaders.ts`, then point at it from `iconDefinitions.ts`.
- `MODEL_ICONS` keys are lowercase substrings matched against the model name in declaration order, so declare a longer pattern before any shorter one it contains. `PROVIDER_ICONS` keys are exact lowercased provider ids, aliases included.
- Prefer mapping a family to an existing icon over duplicating artwork.

## Structure

`references/architecture/context.md` carries the seam map and review defaults. The short version:

- Route, page, and entry files orchestrate. Move parsing, state machines, timers, retries, measurement, multi-step validation, or anything past roughly 25-40 lines behind a deeper module.
- Prefer an existing seam — `routeBuilder`, `ServiceContext`, repositories, provider registrations, `fetch-wrapper`, React Query hooks, shared schemas, `library-agent-core`, `library-registry` — over a new one.
- Generic helpers (serialisation, parsing, string, date, number, guards, validators, formatters, mappers, errors) belong in `src/lib` or `src/utils`, not inline in a feature, route, service, or test file. If you write one inline during a task, move it in the same patch.
- Enforce Work access through workspace membership on the server. A project ID, route nesting, or `created_by` is not proof of authorisation.
- `apps/*` are deployable workspaces; `packages/*` are consumed by more than one of them. Keep package APIs narrow rather than leaking folder structure across workspaces.
- Database schema is Drizzle: edit `apps/api/src/lib/database/schema.ts`, then use the `@assistant/api` scripts (`db:generate`, `db:up`). Use the workspace script for Cloudflare types too. Never hand-edit generated output.
- `scripts/` is for automation reused by package scripts, hooks, CI, or operators. Do not add a one-off script for work an existing package script, test, or migration command already covers.
- Fix types at the source. Do not cast around a type error to quiet the tooling.
- Add dependencies only when necessary and agreed, and commit lockfile changes with the package change.
- Comments explain why, at I/O boundaries, validation rules, security-sensitive behaviour, and edge cases. Do not annotate ordinary lines.

## Validation

Run the narrowest thing that proves the change, then widen only when the blast radius justifies it.

```sh
pnpm --filter @ngriffin_uk/polychat-schemas build   # first, when consumers import generated output
pnpm --filter @assistant/api typecheck
pnpm --filter @assistant/app typecheck
pnpm --filter @assistant/app check                  # @assistant/app is the only workspace with its own check
npx oxlint <changed dirs> && npx oxfmt <changed dirs>   # every other workspace, including @assistant/api
pnpm --filter @assistant/api test <path>
```

- Preserve the existing tooling: oxlint, oxfmt, TypeScript, Vitest, Playwright. Use the workspace `vitest.config.ts` rather than adding ad hoc config.
- Do not start a dev server for routine validation. When you genuinely need signed-in browser validation, use the development magic-link flow in `references/setup.md` and stop anything you started.
- `@assistant/api` has no `check` script. Lint and format it with oxlint and oxfmt directly, or CI's repo-wide `pnpm check` will catch what you skipped.
- If validation cannot run, say so plainly rather than implying it passed. Not having tried is not a blocker — Playwright needs ports 8787 and 5173 free, and `pnpm build:e2e` before `pnpm test:e2e`.

## Testing

- Add a test when it protects user-visible behaviour, an authorisation boundary, a validation rule, a state transition, a persistence or integration contract, or a regression that actually happened.
- Do not add a test solely because code is new. A test that mirrors implementation instead of protecting behaviour is a defect, not coverage.
- Do not test static copy, CSS classes, headings, simple delegation, getters and setters, type-level guarantees, or anything Zod, the router, or the framework already guarantees.
- Extend the nearest existing suite instead of adding a file. Test count and suite runtime are maintenance costs; if a change materially grows a suite, measure that workspace's test command before and after.
- Coverage percentages are not a goal and global thresholds are not welcome. Review uncovered risky boundaries directly.
- Prefer integration-style tests over unit tests of glue, and cover failure paths when changing parsing, auth, persistence, external APIs, or Worker boundaries.
- Playwright is release validation for real journeys — logged-out, Free, Pro, Chat, Work, configuration, message, and responsive. Preserve those journeys when modernising the suite: update Page Objects and assertions rather than narrowing coverage to make tests pass. Follow `references/testing/e2e.md` and mock only outbound third-party services at their boundary.
- A failing journey is product evidence. Do not skip it, weaken its outcome, mock a Polychat route to get past it, or edit fixtures to hide it. Correct a test only when its expectation is demonstrably wrong.

## Security

- Treat OWASP Top 10 as an active concern at real boundaries: command injection, XSS, SQL injection, auth bypass, unsafe redirects, exposed secrets, insecure defaults, and broad CORS or cookie settings.
- Validate and normalise at app boundaries, then trust the value inwards. Re-validating the same data at every layer is noise, not defence.
- Fix insecure code you touch, or say clearly why it cannot be fixed in the same patch.
- Do not over-index. A maintainer-only script or dev-mode affordance does not need the treatment an authenticated write path gets, and threat modelling one is a way of not doing the task.

## Writing

- British English, imperative mood. Lead with the problem, then the change.
- Edit existing prose conservatively and keep its voice.
- Be concise, direct, and opinionated. Name trade-offs rather than hedging.

## Definition of done

- The change follows the user's global contract and these defaults, and any conflict was raised rather than quietly resolved.
- Every surface above was considered, and the ones that applied were changed.
- New models and providers resolve to an icon.
- The narrowest useful validation ran, or the blocker is stated.
- A verification item was recorded for behaviour only a human can confirm, or the change demonstrably needed none.
- Residual risk, assumptions, and follow-ups are stated briefly.
