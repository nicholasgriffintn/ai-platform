# Sandbox Worker

`apps/sandbox-worker` runs coding tasks in Cloudflare Sandbox. The API owns public access, GitHub App authority, dispatch and stored results; the Worker owns repository execution and streamed task events.

## Configure

Use the Worker's example variables and Wrangler manifest. Match `JWT_SECRET` to the API, keep the `POLYCHAT_API` service binding, and configure the Sandbox Durable Object/container. `SANDBOX_TRANSPORT=rpc` selects the persistent SDK transport. Keep `SANDBOX_INSTANCE_TYPE` consistent with the manifest's container instance type for usage reporting.

For service previews, set the same `SANDBOX_PREVIEW_HOST` on the API and Worker, route `*.<host>/*` to the sandbox Worker and set `APP_BASE_URL` to the exact trusted embedding origin. The host must be a custom domain with wildcard DNS and TLS; `.workers.dev` cannot provide the Sandbox SDK's required wildcard routing. Keep preview routes, signing secrets and service bindings separate between local, preview and production deployments.

Bind `BACKUP_BUCKET` to the same private R2 bucket used by the API. Apply an R2 lifecycle rule to remove objects under `backups/` after the environment-cache retention period; the Sandbox SDK records expiry but does not delete expired R2 objects itself.

The internal `/execute` request carries a run JWT and GitHub installation token. Use the shared sandbox schema rather than copied request examples. The API checks explicit model access or resolves its central sandbox preference.

## Execution contract

One runner uses task profiles for implementation, review, tests, fixes, refactoring, documentation and migrations. Planning, tool execution, command approvals, cancellation, timeouts and quality checks belong to that runner. A failed quality gate prevents delivery.

The project delivery policy selects an uncommitted result, local custom preparation, a run-specific review branch or an existing non-protected target branch. New project configuration defaults to a review branch and pull request. The Worker validates before committing and requires exact runner approval before every push; direct delivery rejects `main` and the default branch and rechecks protection at the write boundary. Custom instructions never grant remote-write authority.

The API resolves a fresh GitHub App installation token for the runner and configured repository before dispatch. Keep that credential authority, project policy and command approval separate. Record the branch and commit before attempting delivery, and preserve partial push or pull-request failures in terminal Proof.

Environment preparation uses the shared versioned definition. Polychat-owned configuration is snapshotted into the run; repository-owned configuration is read only from `.polychat/environment.json` at the cloned revision. The definition accepts `version: 1`, `setupCommands`, optional `resumeCommands`, `runtimes`, an optional `packageManager`, `setupTimeoutSeconds` and optional run-scoped `services`.

Run setup commands sequentially through the existing command policy. Check declared versions through fixed internal commands, bound setup time and output, and redact persisted evidence. Do not put secret values in project or repository setup; a referenced environment variable does not grant or mount a credential. Activity owns detailed setup output, while Proof records the configuration source and revision, effective mode, requirements, duration and terminal status.

For project runs with setup configured, derive the snapshot key after clone from project, runner, installation, repository and lockfile identity plus setup and platform versions. Restore only the API-supplied matching handle, then use resume commands. A missing or failed restore cleans tracked and untracked repository state before full setup. Create a replacement before agent execution and exclude Git metadata, environment files, package credentials, keys, tokens and logs.

The API persists snapshot handles only when current membership, repository, installation and cache generation still match. Rebuild, delete and cache-relevant configuration changes increment that generation before object deletion. Conditional writes select one concurrent candidate and remove losers; failed snapshot creation remains run evidence and does not fail successful setup.

Each declared service has a unique name, repository-relative working directory, command, dependencies, optional expected port with a paired HTTP or TCP health check, startup timeout and restart policy. The Worker validates the complete manifest after clone, resolves the real working directory inside the checkout and applies the existing command and approval policy. Duplicate or occupied ports, dependency cycles and paths outside the repository fail before agent work.

Start services after environment preparation in dependency order and keep checking declared network health while the run is active. Background watchers without a port are healthy only while their process is running. Automatic restart is capped by the declaration and the shared schema permits no more than three attempts; an exhausted required service fails the run. Stop active dependants before their dependency and stop everything in reverse order when the run ends.

Service lifecycle and health use the existing coordinator events. Limit and redact log chunks before emission; do not persist process IDs, container addresses or raw terminal access. Runner-only start, restart and stop actions use the existing idempotent instruction endpoint.

The preview gateway accepts only a healthy service's declared non-control-plane port. The API creates a five-minute session through an internal signed exposure grant, and the Worker exchanges a one-time browser bootstrap for a host-only cookie on an opaque origin. Re-authorise current membership, run state, service health and the stored session through `POLYCHAT_API` before every HTTP request and WebSocket message. Authenticate each call as the short-lived, scope-limited sandbox Worker service principal through the normal API middleware and internal route; do not add raw request dispatch in either Worker entry point. Never return or log the Sandbox SDK URL or forwarding token. Strip browser and upstream credentials, reject redirects outside the opaque origin or exact declared loopback port, and keep application cookies unsupported at this boundary.

Terminal logs, diffs, events and manifests are persisted by the API when its asset binding is configured. The Worker reports duration and instance type to `/apps/sandbox/runs/:runId/usage` over the service binding on every terminal path; the API settles its reservation and records infrastructure spend. Missing reports require reconciliation.

Use workspace typecheck and the established end-to-end journeys for routine validation. Start `pnpm --filter @assistant/sandbox-worker dev` only when runtime testing is necessary; deploy only when requested. Check command approval, stop/pause/resume, failed quality gates and terminal results in [release verification](../verification.md).
