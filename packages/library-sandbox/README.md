# @ngriffin_uk/polychat-library-sandbox

Mechanisms every Polychat sandbox host shares: the API's dynamic Worker evaluator, the sandbox Worker that runs coding tasks in a container, and the computer Worker that drives a hosted browser. Nothing here knows about Cloudflare bindings, `IEnv` or `AssistantError`; hosts adapt their I/O and map `SandboxError` codes at one site.

## Dynamic worker code

`renderEvaluationTemplate({ module?, script, preamble?, envKeys? })` produces the `evaluation.js` main module and optional `user-module.js` for a Worker Loader isolate. The template captures `console` output (capped at 500 entries), destructures the user module's exports into the script's scope alongside `module`, `defaultExport` and a frozen `env` limited to `envKeys`, and answers every request with `{ ok, value | error, logs, durationMs }`. `parseEvaluationOutcome` validates that shape on the host side and `workerCodeId` hashes a `WorkerCodeSpec` (modules, compatibility, limits, env and whether outbound traffic is blocked) so identical code reuses an isolate.

## Outbound policy and code mode

`decideOutbound(props, url)` turns a request from inside an isolate into `tool` (a call to the virtual `TOOLS_ORIGIN`), `allow` (the host is on the allowlist, which accepts `*.example.com` wildcards) or `block`. `renderToolProxySource({ tools, binding })` renders the `tools.<name>(args)` object the model writes against; each call is a POST to `TOOLS_ORIGIN/<name>` that the host's gateway dispatches. `describeToolsForModel` renders the matching signatures for a prompt.

## Leases and grants

`createLeaseFence(store)` implements monotonic lease fences over any `{ read, write }` store: `assert` rejects stale fences with `stale_lease`, `revoke` bumps past a lease, `ensureInitialised` seeds a fresh store. `signGrant`/`verifyGrant` sign short-lived claims with HMAC-SHA256 and let the host decide which claims it accepts.

## Execution control

`createExecutionControl({ timeoutMs, abortSignal, control, onPaused, onStillPaused, onResumed })` returns a `checkpoint(abortMessage)` a long-running task calls between steps. It enforces the deadline, honours the abort signal, and when the `RunControlSource` reports `paused` it waits with heartbeats until the run resumes or is cancelled. `redactSandboxOutput` and friends strip secrets from command output before it reaches logs or the model.

## Errors

`SandboxError` carries a code: `cancelled`, `timeout`, `stale_lease`, `invalid_lease`, `invalid_options`, `invalid_result`, `network_blocked`, `tool_unavailable`, `gateway_unavailable`, `execution_failed`. `SandboxCancellationError` and `SandboxTimeoutError` are the two subclasses hosts classify separately.
