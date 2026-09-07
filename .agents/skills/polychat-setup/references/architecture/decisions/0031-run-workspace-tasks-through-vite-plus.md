# ADR 0031: Run workspace tasks through Vite+

Status: Implemented at the repository root, in `packages/config/tasks` and in every buildable workspace package.

## Problem

The monorepo had no task runner. `pnpm -r` walked the workspace, and everything else was arranged by hand around it.

That arrangement had no memory. `pnpm build:packages` rebuilt all twenty-one packages on every invocation, whether or not a single source file had changed, and `pnpm typecheck` prefixed itself with that build because packages resolve each other through `dist/*.d.ts`. The typecheck that followed ran at `--workspace-concurrency=1`, so twenty-odd `tsc` invocations queued behind one another for no reason other than that ordering and parallelism were the same knob in pnpm. Each app then re-implemented the graph locally: `build:deps` scripts of the form `pnpm --filter "@assistant/api^..." --if-present build`, and `test:package` scripts whose whole body was `pnpm build`, repeated in every package so that `release:check` could rebuild everything a second time.

Locally that cost about seventy-six seconds for `pnpm typecheck` and thirty for `pnpm build:packages`. In CI it cost the same on every push, including pushes that touched one file in one app, because nothing was carried between runs.

## Decision

Adopt [Vite+](https://viteplus.dev) as the workspace task runner, and nothing else.

Package builds move out of package.json and become `build` tasks in each package's `vite.config.ts`, declared through a single shared preset in `@ngriffin_uk/polychat-config/tasks`. The preset is where the non-obvious parts live: `dependsOn` pointing at the `build` task of each direct workspace dependency, `input` set to automatic tracking minus `dist/**`, and `output` set to `dist/**`. The exclusion matters — tsup reads back its own declaration output while it writes it, and without the exclusion Vite+ correctly refuses to cache a task that modified its own inputs.

Everything else stays where it was. pnpm remains the package manager, wrangler still builds and serves the Workers, React Router still builds the web application, tsup still produces package output, and Vitest still runs from the root configuration so that coverage stays a single report. Linting and formatting stay on the repository's own oxlint and oxfmt, one minor version ahead of the copies Vite+ bundles, reading the existing `.oxlintrc.json` and `.oxfmtrc.json`.

Root scripts become thin. `build:packages` is `vp run --filter="./packages/**" build`; `typecheck` builds packages and then runs every workspace typecheck in parallel with caching forced on; `dev` runs the API and web servers through `vp run --parallel` with labelled output. The per-app `build:deps` scripts keep their name but delegate to `vp run`, and `test:package` is deleted outright — `vp run -r build` already proves every package builds, and `release:check` no longer needs a second pass to say so.

CI restores and persists `node_modules/.vite/task-cache` through a composite action, so a run inherits the cache of the last run on the branch it forked from.

## Consequences

Repeated work is close to free. A warm `pnpm build:packages` is about one second instead of thirty, and a warm `pnpm typecheck` about four seconds instead of seventy-six. A cold typecheck still improves, to roughly thirty, because the twenty-odd type checks now run concurrently. In CI the practical effect is that a pull request touching one app inherits main's cache and replays the builds of every package it did not touch.

Package builds are no longer reachable through pnpm. `pnpm --filter @ngriffin_uk/polychat-schemas build` finds no script; the command is `vp run --filter=@ngriffin_uk/polychat-schemas build`. This is the real cost of the change, it breaks a documented habit, and the alternative was worse: Vite+ refuses a task that shares a name with a package.json script, so keeping both would have meant naming the tasks something other than what they do.

Two tasks stay uncached, and honestly so. `@assistant/app`'s typecheck runs `react-router typegen` before `tsc -b` and so writes files it also reads; `tsc -b` is incremental, which covers most of the loss locally but not in CI. Caching it would mean declaring inputs and outputs inside `apps/app/vite.config.ts`, which today is a real Vite config typed against `vite` rather than the Vite+ fork, so the Vite+ task fields do not typecheck there. That is a follow-up, not a blocker.

The cache is a correctness surface. It is keyed on tracked inputs, declared environment variables and the config files themselves, and a task that writes outside its declared `output` will replay incompletely. `vp cache clean` is the escape hatch, and a task that reports "not cached because it modified its inputs" is telling the truth about itself rather than failing quietly.

Vite+ is young — this is version 0.3, MIT-licensed, from the team that maintains Vite, Rolldown and Oxc. The exposure is bounded because the adoption is: it orchestrates commands we already ran. Removing it means restoring `build` scripts to twenty-one package.json files and pointing the root scripts back at `pnpm -r`.
