# ADR 0032: Ship shared packages as preserved modules

Status: Implemented in `component-shell`, `component-conversation`, `library-react`, `library-client`, `library-chat` and `schemas`. The remaining packages still bundle with tsup.

## Problem

Every buildable package bundled itself with tsup, and tsup's default is one flattened output file. For a small package that is invisible. For the packages the web app reaches on every route it was not.

A bundler splits chunks by module. A package that collapses into one `dist/index.js` is one module in the consumer's graph, so a route that wants `PricingPage` cannot be given less than everything that package contains, and tree-shaking cannot help: there is nothing smaller to keep. Flattening also swallows third-party dependencies. `zod`, `sonner` and `tailwind-merge` were inlined into each bundle that used them, which put them beyond both deduplication and the app's own vendor chunking, because that keys on `node_modules` appearing in the module id.

Measured on the client build, route-level code splitting did not exist. `/pricing`, `/privacy`, `/terms`, `/` and `/downloads` each closed over the same 2,849 kB, differing by less than half a kilobyte between a pricing page and the home page, and `/pricing`'s own route chunk was 645 bytes. Splitting `component-shell` alone took `/pricing` to 1,779 kB and made routes differ, but left a 839 kB chunk that every route still loaded: `library-react`, `schemas`, `library-client` and `component-ui`, plus the third-party code baked into them.

## Decision

Build the packages on that critical path with `tsc` rather than tsup, emitting one output module per source module into `dist`, mirroring `src`.

This is not a new build style: `utility-core`, `utility-react` and `library-surface` already build this way, and `packages/config/tasks` runs the command either way. Each package keeps its export map and its barrel; `dist/index.js` becomes a list of re-exports across separate files, so the consuming bundler regains the module granularity the source always had, and third-party imports stay external.

Two rules come with it.

Relative import specifiers are written with `.js` extensions in the source. `tsc` emits specifiers verbatim, so this is what makes the published output loadable by Node's ESM loader rather than only by a bundler — and these packages are published, through `changeset publish`. `schemas` gains `"type": "module"`, and its JSON import carries an explicit `with { type: "json" }` attribute for the same reason. The `require` conditions and `.cjs` output are dropped from `library-chat`, `library-client`, `library-react` and `schemas`; nothing in the repository consumed them.

A barrel must not statically re-export a module the package also imports dynamically. Doing so keeps that module in the static graph, and the lazy boundary never splits. Where a module is deliberately loaded on demand it gets its own subpath export instead, and callers that want it eagerly import that subpath: `component-shell/discover-bands` and `component-conversation/keyboard-shortcuts-help` are the two cases.

Subpath exports were considered as the whole answer and rejected. They change every import without fixing the problem — an entry per directory still fuses `PageShell` with `WorkPlaceShell` — and an entry per public module means eighty-seven subpaths maintained by hand. Granularity belongs in the emitted module graph; a subpath is for the narrower case above, where a caller must reach a module without going through the barrel.

## Consequences

Routes differ from one another, and the always-loaded chunk is roughly a fifth of its former weight. `/pricing` closes over 1,426 kB against 2,849 kB before any of this, `/downloads` 1,422 kB, `/terms` 1,525 kB, `/privacy` 1,528 kB and `/` 1,935 kB; the shared chunk behind all of them fell from 839 kB to 379 kB, most of what remains being `zod`, `sonner` and `tailwind-merge`, which are genuinely used everywhere and are now resolved once from `node_modules` instead of copied into several bundles. Package builds are also faster, because tsup's declaration pass dominated its cost.

A `tsc` build does not clear `dist` first, so a renamed or deleted source file leaves its old output behind until the directory is removed. That is already true of the other `tsc`-built packages, and Vite+ replays a task's declared `dist/**` output from cache regardless.

`component-ui` is the one package still on the critical path that has not moved, because it loads PNGs through an esbuild loader that `tsc` has no equivalent for. Its 125 kB, and the third-party code inlined alongside it, is the bulk of the remaining shared chunk.
