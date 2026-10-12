# ADR 0085: Bound sandbox egress at the network

Status: Implemented in `apps/sandbox-worker`; needs a deployed canary before release.

## Problem

The coding sandbox decided network access by matching command text. `NETWORK_COMMAND_PATTERNS` catches `curl` and `npm install`, but `python3 -c "import urllib.request…"`, `node -e "fetch(…)"` and any dependency's install script reach the internet untouched. The container itself had open egress, so a prompt-injected command could send repository contents anywhere.

The credential broker grant also entered the container. Clone, fetch and push passed it as `git -c http.extraHeader`, so any process the agent started could read it from the process list for the life of the run.

## Decision

Start every sandbox container with `enableInternet = false` and HTTPS interception on. All HTTP and HTTPS traffic reaches a Worker-side outbound handler, and every other port is closed.

The handler applies a per-run policy through the shared `sandbox.egress` Cedar decision in `library-sandbox`. Common package registries are read-only: `GET`, `HEAD` and `OPTIONS` pass, and publishing does not. The backup storage endpoint and hosts the project declares in `networkHosts` are allowed in full. The trusted level keeps open egress, still routed through the handler. Blocked requests get a 403 that names the host, and the run's Proof lists blocked hosts as residual risks.

Repository git traffic goes to the broker host, where a dedicated handler accepts only the run's `/git/` path, discards headers the container sent, adds the grant and forwards over the `POLYCHAT_API` binding. The grant never enters the container.

Keep the command patterns as approval hints. They are no longer the boundary.

## Consequences

A run that needs an undeclared host now fails with a clear message instead of succeeding quietly. Projects with private registries or external test APIs must declare them before their next run.

HTTPS interception depends on the container trusting the Cloudflare containers CA. The Sandbox runtime trusts it on a best-effort basis, so the image sets `NODE_EXTRA_CA_CERTS` and `REQUESTS_CA_BUNDLE`, and a deployed canary must confirm a registry install, a brokered clone and a blocked host before release. Non-HTTP protocols such as `git://` and SSH stop working, which matches the broker's HTTPS-only design.
