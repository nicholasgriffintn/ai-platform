# ADR 0066: Read weights from the Hub at pinned commits instead of mirroring them

Status: Accepted. A content-addressed R2 mirror was built and then removed.

## Problem

Keeping a private copy of every imported version protects against a publisher deleting a repository, rewriting its history or changing its terms. It also costs gigabytes of storage and transfer on every import, before anyone has decided the version is worth using.

## Decision

Polychat does not copy weights. Inspection, fine-tuning and dedicated endpoints all read from the Hub at the pinned commit, and nothing in the platform consumed a mirror. Losing an upstream repository is an accepted risk for now: the version record, its file hashes, evidence and decisions remain, so an audit trail survives even if the bytes do not.

## Consequences

If a repository disappears or loses access, its versions can no longer be trained on or deployed, and a re-import fails. Revisit this when a workspace needs air-gapped serving or retention guarantees. The version and file records already carry the SHA-256 needed to verify a restored copy.
