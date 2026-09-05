# ADR 0045: Require an explicit sandbox delivery policy

Status: Accepted and implemented.

The previous coding-environment commit toggle collapsed several materially different outcomes into one boolean. It could not explain whether a run should stop with local changes, prepare a review branch, open a pull request or target an existing branch, and it left too much delivery meaning to the runner.

## Decision

Store one explicit delivery policy with the project coding environment:

- **Leave changes uncommitted** keeps the result inside the run environment.
- **Prepare a review branch** creates a run-specific branch and may open a pull request. Pull request delivery is the default for new configuration.
- **Commit to a configured branch** targets an existing non-default, non-protected branch.
- **Custom instructions** guide how the local result is prepared. They do not authorise a commit, push or pull request.

Treat project configuration as intent, not authority. Before every remote GitHub write, require the initiating runner to approve an exact summary containing the repository, action, branch, target, commit and validation outcome. At execution time, resolve a fresh GitHub App installation token for that runner and repository. Recheck branch protection immediately before a direct push, fail closed when protection cannot be established, and never permit direct delivery to `main` or the repository default branch.

Run validation before preparing an external delivery. A failed quality gate leaves the run undelivered and records the reason in Proof. Record branch, commit, pull request and partial-failure evidence independently so a successful push followed by a failed pull-request request remains visible rather than being reported as an untouched run.

Keep the legacy commit column as a derived rollback shadow during migration. Read a missing policy conservatively: legacy false becomes uncommitted, legacy true becomes a review branch without a pull request, and a newly configured environment defaults to a pull request. The explicit policy is authoritative once present and cannot be made more permissive by the compatibility field.

## Consequence

Delivery now requires more explicit configuration and an approval after validation, and direct branch delivery may stop when GitHub cannot prove the target is safe. In return, saved project intent, runtime authority and the resulting GitHub action remain separately reviewable, migration does not silently add remote writes, and web or iOS can describe the same outcome from the shared run manifest.
