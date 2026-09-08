# ADR 0024: Declare sandbox delivery, environment and services explicitly

Status: Implemented.

## Problem

A coding-environment commit toggle collapsed several materially different outcomes into one boolean: it could not say whether a run should stop with local changes, prepare a review branch, open a pull request or target an existing branch, and it left too much delivery meaning to the runner.

Runs also cloned a repository and entered the agent loop without a reviewable preparation contract, so repeated work could not distinguish full setup from lightweight resume, prove which configuration ran, or report setup failure separately from implementation failure. Repeating full setup every time was slow, but reusing an unscoped filesystem image could cross project or runner authority and retain credentials. Coding work often needs a web application or watcher running while the agent edits, and letting a model launch arbitrary background processes would make health, ports, recovery and shutdown opaque.

## Decision

### Delivery

Store one explicit delivery policy with the project coding environment: leave changes uncommitted, prepare a review branch and optionally open a pull request, commit to a configured non-default and non-protected branch, or supply custom instructions guiding local preparation only. Pull request delivery is the default for new configuration; custom instructions never authorise a commit, push or pull request.

Treat project configuration as intent, not authority. Before every remote GitHub write, require the initiating runner to approve an exact summary naming the repository, action, branch, target, commit and validation outcome. Resolve a fresh GitHub App installation token for that runner and repository at execution, recheck branch protection immediately before a direct push, fail closed when protection cannot be established, and never permit direct delivery to `main` or the repository default branch. Run validation before preparing an external delivery: a failed quality gate leaves the run undelivered and records the reason in Proof. Record branch, commit, pull request and partial-failure evidence independently, so a successful push followed by a failed pull-request creation stays visible.

Read a missing policy conservatively — legacy false becomes uncommitted, legacy true becomes a review branch without a pull request — and keep the legacy column as a derived rollback shadow. The explicit policy is authoritative once present and cannot be made more permissive by the compatibility field.

### Environment preparation

Attach an optional environment setup contract to the project coding environment, using either configuration saved by Polychat or the fixed repository convention `.polychat/environment.json`. Do not accept a model-selected or user-supplied path. Both sources use the same versioned shared schema for full setup commands, lightweight resume commands, runtime and package-manager requirements, a bounded setup timeout and optional services.

Snapshot Polychat-owned configuration into the run at enqueue. Read repository-owned configuration from the cloned `HEAD`, reject oversized, malformed or unsupported definitions, and identify it by its Git blob revision; identify Polychat-owned definitions by a digest of their parsed value. Record source, revision, effective preparation mode, requirements, duration, command count and terminal status in Proof.

Execute setup commands sequentially, because later commands may depend on earlier ones. Validate every command with the existing sandbox command policy and apply the same trust-level approval rules used by agent commands. Use only fixed internal commands to inspect runtime and package-manager versions; never interpolate saved version strings or repository fields into a shell command. A requested resume falls back to full setup when no resume commands are defined. Reject recognisable inline credentials at the shared contract boundary: setup receives no project-stored secret values, and persisted command output is bounded and redacted.

### Environment snapshots

Cache a prepared project environment as a Cloudflare Sandbox directory backup in the existing private R2 bucket. Keep its opaque backup handle only in the API-owned project row and internal worker request; return a redacted summary to clients and record per-run cache provenance in Activity and Proof.

Build the key from project ID, initiating user, GitHub installation, normalised repository, checked-out revision, lockfile blob identities, setup configuration revision, runtime and package-manager requirements, cache generation and platform version. This deliberately prevents reuse by another project member even when both can read the project. A match restores the snapshot and runs resume commands; a miss or failed restore cleans the clone and uses full setup. Back up only the prepared repository before agent work begins, excluding Git metadata, environment files, package credentials, key material, tokens and logs.

Persist creation time, last use, size, repository and configuration revisions, status and invalidation reason. Updating cache-relevant configuration or requesting rebuild or delete increments an API-owned generation before storage deletion; rebuild means the next run performs full setup. Use conditional D1 updates for completion races: the first concurrent snapshot for a key wins, later candidates are deleted, and a replacement may overwrite only the exact stale backup that failed restoration. A run finishing after invalidation, membership loss, repository change or deletion cannot repopulate the cache.

### Declared services

Each service declaration names one repository-relative working directory and command, its service dependencies, an optional expected port with a paired HTTP or TCP health check, a startup timeout and a bounded restart policy. Validate the complete manifest again in the sandbox worker after clone: reject duplicate names and ports, missing or cyclic dependencies, repository traversal, privileged or invalid ports and unbounded restart policies. Resolve the real working directory inside the checkout, apply the existing command and approval policy, and refuse to start when the declared port is already occupied.

Start dependencies in topological order after environment preparation and before agent work. Treat a process without a port as a supervised background service whose process state is its readiness signal. For a network service, require its declared health check to pass within the startup timeout and keep checking it during the run. Restart only according to the saved policy, count every automatic restart against a maximum of three, and fail the run when a required service exits or stays unhealthy after its budget is exhausted. Emit lifecycle, health and bounded redacted log events through the existing run coordinator, and record compact service outcomes in Proof without process IDs, container addresses or unrestricted output.

Only the initiating runner may submit start, restart or stop through the existing idempotent run-instruction endpoint. Stop dependants before their dependency, restart previously active dependants in dependency order, and stop every remaining process in reverse order when the run finishes.

### Environment variables

Store project environment variables as an explicit, separately authorised set rather than reading ambient configuration. Only a workspace owner or admin may write them, values are encrypted at rest, never returned by a list response and excluded from the environment cache key. Inject only the variables a run's setup configuration declares by name, intersected with the stored set, and add every injected value to the run's redaction secrets so bounded output cannot leak one. A declaration naming an unstored variable is a missing input, not an error to work around.

### Inspection

A runner may ask one bounded, policy-checked question of a live environment. Accept a one-shot `run_command` instruction through the existing idempotent run-instruction endpoint, restricted to the initiating runner exactly as service controls are, validated by the same command policy and trust-level approval rules as an agent command, and recorded with bounded redacted output like any other command. It grants nothing: a runner command cannot commit, push, change delivery or alter the validation outcome.

Because a terminal run tears its environment down, allow a project to hold the environment open for a short bounded window after terminal status. The window is off by default, capped in the shared schema, and the runner may extend it once by an explicitly bounded amount. While the window is open the run accepts runner commands and nothing else. When it closes, revoke outstanding preview sessions, destroy the environment and refuse further commands with that reason rather than failing against a dead sandbox. A held environment is metered through the existing run usage path.

## Consequences

Delivery requires more explicit configuration and an approval after validation, and direct branch delivery may stop when GitHub cannot prove the target is safe. In return, saved intent, runtime authority and the resulting GitHub action stay separately reviewable, and migration does not silently add remote writes.

Projects gain a reproducible preparation input, and runs explain setup failure before agent work begins. Repository configuration remains untrusted code and may require an approval or fail under the selected command policy. Repeated runs by the same authorised runner resume from a traceable environment without cached files becoming authority; missing, expired or failed snapshots cost setup time but do not fail an otherwise valid run. Conservative per-runner scoping leaves cross-member performance gains unused, and operators must maintain an R2 lifecycle rule for the backup prefix because SDK expiry prevents restore without deleting objects.

Services are reproducible run inputs rather than ad hoc terminal state, and their failure and timeout paths stay visible after reload. A repository whose declared port is already occupied fails closed instead of attaching to an unknown process. Services are run-scoped, not persistent daemons, and a background watcher without a health endpoint can prove only that its process is alive. Environment variables are governed separately from the configuration that names them, so a run can fail for a missing input that its declaration looks complete without.

A run stays legible after it ends, at the cost of container time a project must opt into. The inspection window is deliberately short and extendable once, so it cannot become a persistent shell by increment, and holding an environment open defers preview revocation until the window closes rather than abandoning it.
