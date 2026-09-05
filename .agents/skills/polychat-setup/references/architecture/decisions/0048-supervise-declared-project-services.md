# ADR 0048: Supervise declared project services within a coding run

Status: Accepted and implemented.

Coding work often needs a web application, supporting API or watcher to remain active while the agent edits and validates the repository. Letting a model launch arbitrary background processes would make health, ports, recovery and shutdown opaque, while a general terminal would create a second execution surface outside the existing sandbox policy.

## Decision

Add optional service declarations to the versioned project environment definition. Each declaration names one repository-relative working directory and command, its service dependencies, an optional expected port with a paired HTTP or TCP health check, a startup timeout and a bounded restart policy. Snapshot the Polychat-owned definition into the run or read the repository-owned definition from the cloned revision as before.

Validate the complete manifest again in the sandbox worker after clone. Reject duplicate names and ports, missing or cyclic dependencies, repository traversal, privileged or invalid ports and unbounded restart policies. Resolve the real working directory inside the checkout, apply the existing command and approval policy, and refuse to start when the declared port is already occupied.

Start dependencies in topological order after environment preparation and before agent work. Treat a process without a port as a supervised background service whose process state is its readiness signal. For a network service, require its declared health check to pass within the startup timeout and continue checking it during the run. Restart only according to the saved policy, count every automatic restart against a maximum of three, and fail the run when a required service exits or remains unhealthy after its budget is exhausted.

Emit lifecycle, health and bounded redacted log events through the existing sandbox run coordinator. Record compact service outcomes in Proof without process IDs, container addresses or unrestricted output. No service port is externally reachable in this decision; a future preview gateway may resolve only the port declared for the current authorised run.

Let only the initiating runner submit start, restart or stop through the existing idempotent run-instruction endpoint. The worker applies those actions to the declared service graph, stops dependants before their dependency and restarts previously active dependants in dependency order. Other project members may observe health and logs through project membership but do not inherit runner controls. Stop every remaining process in reverse dependency order when the run finishes.

## Consequence

Project services are reproducible run inputs rather than ad hoc terminal state, and their failure and timeout paths remain visible after reload. Service commands may still require an interactive approval, and a repository whose declared port is already occupied fails closed instead of attaching to an unknown process. Services are run-scoped rather than persistent daemons; stopping the sandbox ends them, and background watchers without a health endpoint can prove only that their process remains alive.
