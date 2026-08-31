# ADR 0030: Version authored skills with D1 state and R2 bundles

## Status

Accepted

## Context

ADR 0019 made a mutable R2 document the complete authored-skill record and deliberately deferred revision history. That works for CRUD, but an overwrite cannot prove which instructions ran, preserve a known-good release while editing, or recover cleanly from a partial multi-object resource update.

Skills now need immutable revisions, draft and stable state, and a migration path that does not take existing personal or project skills offline. D1 and R2 still cannot share a transaction, so the boundary must define which store owns authority and how failed cross-store writes are compensated.

## Decision

Give every authored skill a D1 identity keyed by its personal or project scope and immutable Agent Skills name. Store immutable revision metadata in D1 and keep mutable `draft` and `stable` revision pointers with an integer state version for compare-and-swap updates. The first revision is both draft and stable. The repository can append a draft without moving stable, but the existing public update routes advance both pointers atomically until the promotion and rollback workflow provides a usable way to activate drafts.

Store each complete revision as one immutable private R2 JSON object containing `SKILL.md` and its resources in canonical path order. Hash the canonical content with SHA-256, persist the digest and byte size in both the object and revision metadata, and verify both on read. Reject duplicate resource paths and bundles over the shared size limit before writing.

Write the R2 revision before its D1 metadata and pointer change. Commit the identity and initial revision, or an appended revision and its conditional pointer update, in one atomic D1 batch. If that batch fails, delete the new object on a best-effort basis and leave the previous pointers unchanged. A failed compensation may leave an unreachable immutable object, never a partially active revision. Archive identity in D1 before best-effort legacy-object cleanup; the archived identity remains a migration tombstone as well as revision history.

Import legacy deterministic R2 documents lazily when a scope is listed or read. Validate and copy the complete legacy document into an immutable bundle, then create the D1 identity with conflict-safe semantics and re-read the winner. Never reimport a legacy object when an active or archived D1 identity already records that scope-local name. Keep legacy objects during the compatibility period so deployment rollback remains possible.

Project capability rows continue to grant a skill by its immutable scope-local name. Workspace membership and owner/administrator checks remain outside storage in the existing management seam.

## Consequences

D1 becomes the authority for authored-skill identity and active state, while R2 remains the authority for revision content. Listing no longer depends on R2 object metadata. Runtime catalogue resolution uses stable revisions; draft content cannot affect a conversation until promoted.

The model supports exact provenance and rollback without copying document bodies into D1. It also introduces cross-store orphan cleanup as an operational concern and adds one D1 lookup plus one R2 read when authored instructions are loaded.

This decision supersedes ADR 0019's choice to avoid a skill table and overwrite deterministic R2 keys. Its validation, scope, private-storage, project-authorisation, and audit decisions remain in force.
