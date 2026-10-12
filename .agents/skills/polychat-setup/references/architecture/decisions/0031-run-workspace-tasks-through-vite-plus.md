# ADR 0031: Run workspace tasks through Vite+

Status: Implemented in the repository task config and workspace packages.

## Problem

Recursive package scripts duplicated dependency ordering and rebuilt unrelated work. CI also repeated work without reusing task outputs.

## Decision

- Use Vite+ to define and run workspace tasks, with a shared task preset for package builds.
- Declare task dependencies, inputs and outputs so the runner can order work and cache valid results.
- Keep pnpm as the package manager. Keep Wrangler, React Router, tsup, Vitest, oxlint and oxfmt responsible for their existing jobs.
- Keep root scripts as orchestration over the task graph. Invoke package build tasks through `vp run`; package scripts remain for tasks that are not part of that graph.

## Consequences

Workspace builds and typechecks can run in dependency order with cache reuse. A task must declare its inputs and outputs accurately; incorrect declarations can make cached results incomplete. Inspect the task configuration before adding or moving a workspace task.
