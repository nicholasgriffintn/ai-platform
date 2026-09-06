# Desktop shell egress boundary

- **Change:** A Tauri shell whose Rust core is the only route to the network, exposing endpoint listing and readiness probing to a sandboxed webview that holds no remote connection permission of its own.
- **Surfaces:** `apps/desktop` only. No web, API, iOS or sandbox behaviour changes.
- **Prerequisites:** macOS with Xcode command line tools; the pinned Rust toolchain in `apps/desktop/src-tauri/rust-toolchain.toml`; `pnpm install`; Ollama or LM Studio installed to exercise a ready state.
- **Risk if wrong:** The webview reaches the network directly, defeating the boundary [ADR 0076](../../.agents/skills/polychat-setup/references/architecture/decisions/0076-desktop-core-owns-egress.md) exists to establish.
- **Commits:** none recorded.

## Verify

- [ ] Run `pnpm --filter @assistant/desktop dev`; confirm the window opens, lists the Ollama and LM Studio loopback endpoints, and reports both as not running when neither is installed.
- [ ] Start Ollama, press Check against it, and confirm the readiness state becomes ready while LM Studio stays not running.
- [ ] Stop Ollama mid-session and probe again; confirm the state returns to not running rather than staying ready.
- [ ] In the running window's developer tools, attempt `fetch("http://127.0.0.1:11434/api/tags")` and any external origin; confirm the content security policy blocks both, so loopback is reachable only through the Rust command.
- [ ] Confirm no capability beyond `core:default` is granted in `src-tauri/capabilities/default.json`, and that no shell, filesystem or HTTP plugin permission has been added.

**Stop and report if:** the webview reaches any origin directly, a probe reports ready for a runtime that is not running, or the window renders before the endpoint list resolves without showing that it is still checking.

**Local automated evidence:** `cargo test` in `apps/desktop/src-tauri` covers the egress refusals — an unconfigured endpoint, a remote host declared as loopback, a non-HTTP scheme, and an unprotected network agent runtime — and `packages/schemas/src/desktop-runtimes.test.ts` covers the same invariants on the contract side. Neither exercises a real runtime or the packaged window, so every item above remains a human check.

Packaging, signing and updates are deliberately out of scope here: `bundle.active` is `false` until signing material exists.
