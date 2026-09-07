# ADR 0032: Ship the navigation shell as preserved modules

Status: Implemented in `packages/component-shell`.

## Problem

Every buildable package bundled itself with tsup, and tsup's default is one flattened output file. For most packages that is invisible. For `component-shell` it was not.

The shell holds the whole connected surface of both apps — the place shells, the sidebars, the pricing page, the privacy and terms copy, the Work project context and the live-chat wiring — behind one barrel. Because the whole package collapsed into a single `dist/index.js`, that file was one module in the consumer's graph. A bundler splits chunks by module, so a route that imported `PricingPage` could not be given less than everything the shell contains, and tree-shaking could not help: there was nothing smaller to keep.

The effect was that route-level code splitting did not exist in the web app. Measured on the client build, the static chunk closure behind `/pricing`, `/privacy`, `/terms`, `/` and `/downloads` was the same 2,849 kB in every case, differing by less than half a kilobyte between a pricing page and the home page. `/pricing`'s own route chunk was 645 bytes; everything else it loaded was the shared blob. The `lazy()` boundaries inside the shell were inert for the same reason, and rolldown said so through `INEFFECTIVE_DYNAMIC_IMPORT`.

## Decision

Build `component-shell` with `tsc` rather than tsup, emitting one output module per source module into `dist`, mirroring `src`.

This is not a new build style for the repository: `utility-core`, `utility-react` and `library-surface` already build this way, and `packages/config/tasks` runs the command either way. The package keeps its single `.` export and its barrel; `dist/index.js` becomes a list of re-exports across separate files instead of a 600 kB module, so the consuming bundler regains the module granularity the source always had.

Subpath exports were the obvious alternative and were rejected. They would have changed every import in both apps, and they would not have fixed the problem: an entry per directory still fuses `PageShell` with `WorkPlaceShell`, and an entry per public module means eighty-seven subpaths maintained by hand. Granularity belongs in the emitted module graph, not in the export map.

## Consequences

Routes now differ from one another. `/pricing` closes over 1,779 kB instead of 2,849 kB, `/privacy` over 1,883 kB, `/downloads` over 1,777 kB; the shell contributes only the modules a route reaches, and `PageShell` is its own 8 kB chunk shared by the routes that use it. The shell's own build is also faster — about 2.5s for code and declarations together, against roughly 6s for tsup, whose declaration pass dominated.

Relative import specifiers in the emitted JavaScript stay extensionless, exactly as they are written in the source, because neither `tsc` nor esbuild rewrites them. That is already true of the other `tsc`-built packages, and it is resolvable by every consumer we have, all of which are bundlers. It would not be resolvable by Node's ESM loader, so publishing these packages for direct Node consumption would first mean writing `.js` extensions in the source.

Two limits are worth naming, because this change makes them visible rather than causing them. Dynamic imports of a module that the barrel also re-exports statically — `Discover/DiscoverBands` is the one case — still cannot move into their own chunk. And the largest remaining shared chunk on every route is not the shell: it is `component-conversation` and `library-chat`, still flat tsup bundles, reached from `root.tsx` through `customResponseViews`. Giving them the same treatment is the next move, not part of this one.
