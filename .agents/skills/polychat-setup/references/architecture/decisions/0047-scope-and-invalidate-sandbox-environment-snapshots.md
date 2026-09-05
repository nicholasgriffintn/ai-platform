# ADR 0047: Scope and invalidate sandbox environment snapshots

Status: Accepted and implemented.

Repeated coding runs previously executed full environment setup even when the repository, lockfiles and setup definition had not changed. Reusing an unscoped filesystem image would be faster, but could cross project or runner authority, retain credentials or hide where a run's environment came from.

## Decision

Cache a prepared project environment as a Cloudflare Sandbox directory backup in the existing private R2 bucket. Keep its opaque backup handle only in the API-owned project row and internal worker request. Return a redacted summary to clients and record per-run cache provenance in Activity and Proof.

Build the key from project ID, initiating user, GitHub installation, normalised repository, checked-out revision, lockfile blob identities, setup configuration revision, runtime and package-manager requirements, cache generation and platform version. This deliberately prevents reuse by another project member even when both can read the project. A match restores the snapshot and runs the definition's resume commands; a miss or failed restore uses clean full setup.

Back up only the prepared repository before agent work begins. Exclude Git metadata, environment files, package credentials, key material, tokens and logs. Project setup still receives no stored secret mount. Configure the Sandbox Worker `BACKUP_BUCKET` binding to the same private bucket and an R2 lifecycle rule for the `backups/` prefix; SDK expiry prevents restore after the recorded TTL, while the lifecycle rule removes expired objects.

Persist creation time, last use, size when R2 reports it, repository and configuration revisions, status and invalidation reason. Updating cache-relevant project configuration or requesting rebuild/delete increments an API-owned generation before storage deletion. Rebuild means the next coding run performs full setup and creates the replacement; it does not add another execution runtime.

Use conditional D1 updates for completion races. The first concurrent snapshot for a key wins and later candidates are deleted. A replacement may overwrite only the exact stale backup that failed restoration. A run finishing after invalidation, membership loss, repository change or deletion cannot repopulate the cache because its generation or authority boundary no longer matches.

## Consequence

Repeated runs by the same authorised runner can resume from a traceable environment without turning cached files into authority. Missing, expired or failed snapshots cost setup time but do not fail an otherwise valid run. Conservative per-runner scoping leaves potential cross-member performance gains unused, and operators must maintain R2 lifecycle cleanup for abandoned or expired SDK backups.
