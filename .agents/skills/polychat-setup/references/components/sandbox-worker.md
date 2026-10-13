# Sandbox worker

`apps/sandbox-worker` runs coding tasks and hosted computers on Cloudflare Sandbox SDK 1.0. The API owns public access, project authority, GitHub credentials, dispatch and stored results; the worker owns repository and process execution. Its `Workspace` class also serves the workspace tools of hosted agent harnesses, and its `Computer` class hosts the built-in browser.

## Configure

- Use `apps/sandbox-worker/wrangler.json` and `.dev.vars.example`. Keep `JWT_SECRET` aligned with the API and retain the `POLYCHAT_API` service binding.
- Keep the `@cloudflare/sandbox` version and the `cloudflare/sandbox` image tag that provides `sandbox-shim` aligned. Both classes use the `durable_object` scheduling policy and pick their image (`code` or `browser`) when they start.
- For previews, use the same `SANDBOX_PREVIEW_HOST` in the API and worker, set `VITE_SANDBOX_PREVIEW_HOST` when building the app, and set the trusted `APP_BASE_URL`. Preview routing needs wildcard DNS and TLS on a custom domain.
- Bind `BACKUP_BUCKET` to the API's private assets bucket and apply R2 lifecycle rules that expire `environment-cache/` and `computer-profiles/` objects.
- Workspaces start without internet access. Outbound requests go through the `WorkspaceOutbound` entrypoint and are limited to read-only package registries and declared `networkHosts`; repository Git uses the API broker. Export `WorkspaceOutbound` and `DirectoryBackupGateway` from the entry point.

## Execution boundaries

- A project delivery policy records intent. Run validation before delivery, require the runner's exact approval before remote writes, and recheck the target branch's protection at the write boundary.
- Environment setup comes from saved project configuration or `.polychat/environment.json` at the checked-out revision. Validate commands through the existing policy; configuration does not grant access to secrets.
- Reuse snapshots only for the matching project, runner, repository, revision and setup configuration. Exclude Git metadata, credentials, environment files and logs; invalidate snapshots when their authority or inputs change.
- Validate declared services after cloning. Start them in dependency order, enforce bounded health and restart rules, and stop them when the run ends.
- Preview only a healthy service's declared port. Recheck membership, run state and session authority on every request.

See [release verification](../verification.md) for operator checks and [E2E checks](../../../../../apps/app/tests/e2e/README.md) for the browser test commands. Deploy only when requested.
