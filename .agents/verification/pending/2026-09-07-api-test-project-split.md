# The API unit suite still runs every test after the isolation split

- **Change:** `@assistant/api` is now two Vitest projects — `api` for files that mock modules, `api:shared-registry` for files that do not, which share a module registry instead of re-evaluating their import graph per file. The root `vitest.config.ts` lists both explicitly, so the previous `apps/*` glob no longer discovers the API project.
- **Surfaces:** CI only. No runtime, API or client behaviour changes.
- **Prerequisites:** none.
- **Risk if wrong:** the root project list silently omits a project and its tests stop running while CI stays green. Adding a new app under `apps/` now needs a line in the root project list.
- **Commits:** see the pull request for this change.

## Verify

- [ ] On the Test workflow run for this change, confirm the Vitest summary reports the same total as the previous run on `main` (488 files, 3208 tests) rather than a smaller number.
- [ ] Confirm both `api` and `api:shared-registry` appear as project labels in that run.
- [ ] Compare the "Run tests" step duration against the previous `main` run and record it; the change reduces CPU work by roughly 15% but its effect on wall time depends on how many cores the runner has.

**Stop and report if:** the reported test total is below 3208, or either API project label is missing from the run.
