# Desktop shell egress boundary

- **Change:** A Tauri shell whose Rust core is the only route to the network, exposing endpoint listing and readiness probing to a sandboxed webview that holds no remote connection permission of its own.
- **Surfaces:** `apps/desktop` only. No web, API, iOS or sandbox behaviour changes.
- **Prerequisites:** macOS with Xcode command line tools; the pinned Rust toolchain in `apps/desktop/src-tauri/rust-toolchain.toml`; `pnpm install`; Ollama or LM Studio installed to exercise a ready state.
- **Risk if wrong:** The webview reaches the network directly, defeating the boundary [ADR 0076](../../.agents/skills/polychat-setup/references/architecture/decisions/0076-desktop-core-owns-egress.md) exists to establish.
- **Commits:** none recorded.

## Verify

- [ ] Run `pnpm --filter @assistant/desktop dev`; confirm the window opens, lists the Ollama and LM Studio loopback endpoints, and reports both as not running when neither is installed.
- [ ] Start Ollama, press Check against it, and confirm the readiness state becomes ready while LM Studio stays not running.
- [ ] Confirm the models listed under Ollama match `ollama list`, with the same sizes, and that a vision model is marked as such.
- [ ] Start LM Studio with its local server enabled and confirm its models list with real context lengths, that a loaded model is marked loaded, and that embedding models are omitted.
- [ ] Confirm a runtime that is running but has no models installed says so rather than showing an empty list with no explanation.
- [ ] Pick a model, send a prompt, and confirm text arrives incrementally rather than in one block, with the progress state moving from loading the model to generating.
- [ ] Press Stop mid-generation; confirm text stops arriving promptly, the run reports itself finished, and a further prompt still works.
- [ ] Ask for a model that is not installed and confirm the failure names the runtime and does not leave the composer stuck as running.
- [ ] Stop Ollama mid-session and probe again; confirm the state returns to not running rather than staying ready.
- [ ] In the running window's developer tools, attempt `fetch("http://127.0.0.1:11434/api/tags")` and any external origin; confirm the content security policy blocks both, so loopback is reachable only through the Rust command.
- [ ] Restart the application and confirm the endpoint list, including anything added or forgotten, comes back as it was left.
- [ ] Add a plain HTTP agent runtime on a network address and confirm it is refused for wanting HTTPS or a pairing secret; add the same address over HTTPS and confirm it is accepted.
- [ ] Add an address that is not loopback while claiming loopback and confirm it is refused before anything is stored.
- [ ] Send a prompt, close the window, reopen it and confirm the exchange is still there under that model.
- [ ] Confirm a cancelled run still stores whatever text arrived before it stopped, rather than discarding it or storing nothing.
- [ ] Confirm a stopped reply is shown as stopped when the conversation is reopened, and that it is never silently continued or replayed.
- [ ] Press Sign in with GitHub; confirm the system browser opens, sign-in completes, the browser page says it is safe to close, and the window reports being signed in.
- [ ] Confirm the session is in the operating system keychain under the application identifier, and that it is not in the local database, the window's storage or any log.
- [ ] Restart and confirm the signed-in state survives; sign out and confirm the keychain entry is gone.
- [ ] Abandon a sign-in by closing the browser tab; confirm the window recovers and a second attempt still works.
- [ ] Confirm device-local chat still works while signed out and with no network.
- [ ] While signed in, send a prompt to a cloud tier and confirm text streams back and Stop ends it.
- [ ] Confirm the hosted stream is read correctly against the real API: the reply must arrive as text, not as raw event JSON or nothing at all.
- [ ] Sign out and confirm a cloud prompt is refused with a message telling you to sign in, while device-local chat still works.
- [ ] Add a running OpenClaw or Hermes gateway, check it, and confirm its sessions list with the machine that would execute them, including one started from another channel.
- [ ] Send a prompt into a session and confirm the reply streams back and appears in the gateway's own interface too.
- [ ] Provoke an action needing permission; confirm Polychat shows what it would do and on which machine, that refusing stops it, and that nothing runs before a decision.
- [ ] Confirm no action is ever auto-approved and that no standing approval can be granted.
- [ ] Confirm no capability beyond `core:default` is granted in `src-tauri/capabilities/default.json`, and that no shell, filesystem or HTTP plugin permission has been added.

**Stop and report if:** a session token appears anywhere but the keychain, a redirect outside loopback is accepted, the webview reaches any origin directly, a probe reports ready for a runtime that is not running, a cancelled run keeps producing text, or the window renders before the endpoint list resolves without showing that it is still checking.

**Local automated evidence:** `cargo test` in `apps/desktop/src-tauri` covers the egress refusals — an unconfigured endpoint, a remote host declared as loopback, a non-HTTP scheme, and an unprotected network agent runtime — plus model parsing, request building and stream-line parsing for both vendors from fixture payloads, including an unexpected response shape, the cancellation registry, endpoint persistence including seeding, renaming, replacing and forgetting, conversation storage covering account partitioning, message ordering and recency, the loopback callback parser, the hosted stream parser in both delta shapes it emits, and the agent-gateway parsers for session envelopes, unknown session and approval kinds, and approval extraction. On the API side, `apps/api/src/services/auth/__test__/native.test.ts` covers the redirect rules for both native platforms, including refusal of `localhost`, a lookalike host, a privileged port, and anything smuggled past the path. `packages/schemas/src/desktop-runtimes.test.ts` covers the same egress invariants on the contract side. Nothing exercises a real runtime or the packaged window: the discovery fixtures were written from the published response shapes rather than captured from a running Ollama or LM Studio, so confirming the real payloads still parse is the first thing to check. The agent-gateway paths and payloads were inferred rather than taken from a published contract, so a gateway answering with a different shape is expected and must degrade to an empty list rather than a broken window. The hosted parser was written from the API's own delta extraction rather than from a captured response, so it carries the same risk.

Packaging, signing and updates are deliberately out of scope here: `bundle.active` is `false` until signing material exists.
