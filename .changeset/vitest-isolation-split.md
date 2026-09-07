---
"@ngriffin_uk/polychat-config": minor
---

Add `@ngriffin_uk/polychat-config/vitest/isolation` for splitting a test suite by whether it mutates the module registry.

Vitest isolates every test file by default, so each one re-evaluates its whole import graph. That is the price of `vi.mock`, which needs a per-file module registry, but most test files never mock anything and pay it anyway.

`splitTestFilesByIsolation(projectRoot)` walks a project's test files and reports which ones reach for `vi.mock`, `vi.spyOn`, `vi.stubGlobal`, `vi.stubEnv` or fake timers, so a config can run those isolated and let the rest share a worker.
