# Verify supervised project services

- **Change:** Project environment definitions can start and supervise declared applications, APIs and watchers during a coding run.
- **Surfaces:** Project coding settings, Work Project Workbench, sandbox lifecycle API and sandbox worker.
- **Prerequisites:** A disposable coding-enabled project with a service command that can expose an HTTP or TCP health check inside Cloudflare Sandbox.
- **Risk if wrong:** A service can attach to the wrong port, restart without limit, outlive its run or expose unbounded output or runner-only controls.
- **Commits:** None recorded.

## Verify

- [x] Add a watcher without a port and an HTTP service that depends on it. Start a run and confirm Activity shows both declarations, starts the watcher first, reports the HTTP service healthy and keeps logs collapsed and bounded.
- [x] Reload during the run. Confirm service health and restart counts restore from recorded events without exposing a process ID, container address, terminal or undeclared port.
- [x] Restart the watcher from Activity. Confirm its active dependant stops first and both return in dependency order. Stop the HTTP service, then start it again and confirm each action appears once.
- [x] Open the run as another project member. Confirm health and logs remain readable but service controls are unavailable. Retry one action with the same idempotency key and confirm it is not applied twice.
- [x] Configure duplicate ports, a dependency cycle, a directory outside the repository, an inline credential and a command requiring approval. Confirm invalid declarations cannot save or start, and the risky command waits for the initiating runner's approval.
- [x] Occupy the declared port before startup and confirm the run fails rather than treating the existing process as healthy. Configure a health path that never succeeds and confirm startup stops at its timeout.
- [x] Make a running service fail under each restart policy. Confirm `never` does not restart, `on_failure` ignores only a clean exit, `always` restarts a clean exit, and no policy exceeds three automatic attempts.
- [x] Cancel or complete the run with services active. Confirm every service stops in reverse dependency order and later controls conflict with the terminal run.

**Stop and report if:** a non-runner controls a service, an undeclared port becomes reachable, a process survives the run, output is unbounded or unredacted, or automatic restarts exceed the saved limit.

**Automated evidence:** `features/sandbox-controls.spec.ts` passes completion and cancellation with a watcher and dependent HTTP service. Verify dependency-ordered startup, reverse-order shutdown, stopped terminal Proof and terminal mutation conflicts; repeated cancellation preserves the terminal result.

`features/sandbox-services.spec.ts` confirms validation of duplicate ports, dependency cycles, repository boundaries and inline credentials; deterministic occupied-port and health-timeout failures; every restart policy and its saved cap; bounded collapsed output; reload restoration; dependency-ordered restart, stop and start; exact-once service actions; idempotent replay; rejection of conflicting replay; preview revocation; and stopped terminal state. The approval suite covers the risky-command boundary, while the member suite covers readable evidence and runner-only controls. Service output is collected through bounded polling so process teardown does not leave the SDK callback stream open.
