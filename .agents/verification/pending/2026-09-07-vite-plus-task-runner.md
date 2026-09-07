# Release, deploy and desktop builds still produce the same output under Vite+

- **Change:** Vite+ now runs workspace tasks. Package builds moved from package.json scripts to `build` tasks in each package's `vite.config.ts`, root `build:packages`, `typecheck` and `dev` run through `vp run`, the per-package `test:package` scripts are gone, and CI restores a task cache from `node_modules/.vite/task-cache`.
- **Surfaces:** none at runtime; the build, release and deployment pipelines for web, API, desktop, sandbox and training.
- **Prerequisites:** none. The cache is created on first use and is ignored by git.
- **Risk if wrong:** a cached task replays stale package output, so a deployment or a published package ships code that does not match the commit.

## Verify

- [ ] Run `pnpm build:packages` twice and confirm the second run reports cache hits and leaves `dist` output identical to the first.
- [ ] Change one source file in `packages/schemas`, run `pnpm build:packages`, and confirm that package and its dependents rebuild while unrelated packages replay from cache.
- [ ] Run `pnpm release:check` on a clean checkout and confirm it passes without the removed `test:package` step.
- [ ] Deploy the API and the web application to preview and confirm the deployed bundles behave as the same commit did before this change.
- [ ] Run the desktop workflow and confirm the renderer builds and the Tauri bundle is produced.
- [ ] Confirm a CI run on a branch restores a task cache from its parent and that a full `pnpm check`, `pnpm typecheck` and `pnpm ci:test` still pass on a cold cache.

**Stop and report if:** a cached replay produces `dist` output that differs from a clean rebuild, or a deployed Worker behaves differently from a build made with the cache cleared through `pnpm exec vp cache clean`.
