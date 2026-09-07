# Web and desktop still behave the same with the navigation shell split into modules

- **Change:** `packages/component-shell` builds with `tsc` instead of tsup, so `dist` mirrors `src` as one module per source file rather than a single flattened `dist/index.js`. The package's exports, its barrel and every consumer import are unchanged; only the emitted module graph differs, which lets the web and desktop bundlers split routes.
- **Surfaces:** web and desktop. No API, sandbox, training or iOS change.
- **Prerequisites:** none. Delete `node_modules/.vite/task-cache` or run `pnpm exec vp cache clean` if a stale shell build is suspected.
- **Risk if wrong:** chunk boundaries move, so a route can fail at load with a missing or circular module rather than at build time. Lazy boundaries inside the shell now resolve to real network requests, so a failure appears as a blank pane or a stuck loading state on one route while the rest of the app works.

## Verify

- [ ] Load `/pricing`, `/privacy`, `/terms`, `/`, `/discover` and `/downloads` on a deployed preview and confirm each renders with no console error and no failed chunk request.
- [ ] Open a chat conversation and a Work project conversation, confirm messages stream and the project sidebar and header render.
- [ ] Open the global search dialog and the meta-assistant overlay from a route that does not otherwise use them, and confirm both load on demand.
- [ ] Navigate between a Chat route and a Work route without a full reload and confirm no module error appears in the console.
- [ ] Run the desktop build, launch the packaged app and confirm the sidebar, pricing page and a conversation all render.

**Stop and report if:** any route fails to load a chunk, a lazily loaded panel never resolves, or the desktop renderer shows a module resolution error that the web build does not.
