# Sandbox Worker

`apps/sandbox-worker` runs coding tasks in Cloudflare Sandbox. The API owns public access, GitHub App authority, dispatch and stored results; the Worker owns repository execution and streamed task events.

## Configure

Use the Worker's example variables and Wrangler manifest. Match `JWT_SECRET` to the API, keep the `POLYCHAT_API` service binding, and configure the Sandbox Durable Object/container. `SANDBOX_TRANSPORT=rpc` selects the persistent SDK transport. Keep `SANDBOX_INSTANCE_TYPE` consistent with the manifest's container instance type for usage reporting.

The internal `/execute` request carries a run JWT and GitHub installation token. Use the shared sandbox schema rather than copied request examples. The API checks explicit model access or resolves its central sandbox preference.

## Execution contract

One runner uses task profiles for implementation, review, tests, fixes, refactoring, documentation and migrations. Planning, tool execution, command approvals, cancellation, timeouts and quality checks belong to that runner. A failed quality gate prevents commits.

Terminal logs, diffs, events and manifests are persisted by the API when its asset binding is configured. The Worker reports duration and instance type to `/apps/sandbox/runs/:runId/usage` over the service binding on every terminal path; the API settles its reservation and records infrastructure spend. Missing reports require reconciliation.

Use workspace typecheck and focused tests for routine validation. Start `pnpm --filter @assistant/sandbox-worker dev` only when runtime testing is necessary; deploy only when requested. Check command approval, stop/pause/resume, failed quality gates and terminal results in [release verification](../verification.md).
