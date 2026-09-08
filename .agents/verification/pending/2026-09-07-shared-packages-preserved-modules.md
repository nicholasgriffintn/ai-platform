# Every surface still behaves the same with the shared packages split into modules

- **Change:** `schemas`, `library-react`, `library-client`, `library-chat` and `component-conversation` build with `tsc` instead of tsup, so each emits one module per source file. Their relative imports now carry `.js` extensions, `schemas` is `"type": "module"` and reads its generated JSON with an import attribute, and the `require` conditions and `.cjs` output are gone from all four dual-format packages. `component-shell/discover-bands` and `component-conversation/keyboard-shortcuts-help` are new subpath exports, and both modules no longer come out of their package barrel.
- **Surfaces:** web, desktop, API, sandbox and training. No iOS change.
- **Prerequisites:** none. Run `pnpm exec vp cache clean` if a stale package build is suspected. The API Worker could not be bundled locally for this change because `apps/api/wrangler.jsonc` is not in the repository; its first preview deploy is the real check.
- **Risk if wrong:** a Worker fails to bundle or throws on start because a module specifier no longer resolves, or a web route fails at load with a missing module. Dropping the CommonJS entry points would break any consumer that still used `require`; none were found in the repository, but a published consumer outside it would break at install time.

## Verify

- [ ] Deploy the API to preview and confirm it starts, serves a chat completion and streams, with no module resolution error in the Worker logs.
- [ ] Deploy the sandbox and training Workers to preview and confirm each starts and handles one request.
- [ ] Load `/`, `/pricing`, `/privacy`, `/terms`, `/discover` and `/downloads` on a web preview and confirm each renders with no failed chunk request.
- [ ] On `/`, scroll to the Discover tour and confirm it appears after its chunk loads; on `/discover`, confirm the same content renders immediately without a visible loading gap.
- [x] Open the keyboard shortcuts dialog from a conversation and confirm it loads and closes.
- [ ] Open a chat conversation and a Work project conversation, confirm messages stream and attachments upload.
- [ ] Run the desktop build, launch the packaged app and confirm the sidebar, discover page and a conversation all render.

**Stop and report if:** a Worker logs a module resolution failure, a route fails to fetch a chunk, or the Discover tour never appears on the home page.

## Automated evidence — 8 September 2026, container aaec9551

- `features/app.spec.ts` passed the complete Chat, Work, settings, shortcuts, Terms and Privacy journey. The shortcuts dialog loads from Chat, shows its contents and closes before navigation continues. Preview and packaged-desktop checks remain open.
