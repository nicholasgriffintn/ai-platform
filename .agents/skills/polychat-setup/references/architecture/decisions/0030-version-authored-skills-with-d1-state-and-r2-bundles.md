# ADR 0030: Version authored skills with D1 state and R2 bundles

## Status

Accepted

## Context

ADR 0019 made a mutable R2 document the complete authored-skill record and deliberately deferred revision history. That works for CRUD, but an overwrite cannot prove which instructions ran, preserve a known-good release while editing, or recover cleanly from a partial multi-object resource update.

Skills now need immutable revisions and draft and stable state. D1 and R2 cannot share a transaction, so the boundary must define which store owns authority and how failed cross-store writes are compensated. The earlier R2-only format was short-lived, and maintaining a runtime compatibility layer would cost more than manually republishing the affected skills.

## Decision

Give every authored skill a D1 identity keyed by its personal or project scope and immutable Agent Skills name. Store immutable revision metadata in D1 and keep mutable `draft` and `stable` revision pointers with an integer state version for compare-and-swap updates. The first revision is both draft and stable. The repository can append a draft without moving stable, but the existing public update routes advance both pointers atomically until the promotion and rollback workflow provides a usable way to activate drafts.

Store each complete revision as one immutable private R2 JSON object containing `SKILL.md` and its resources in canonical path order. Hash the canonical content with SHA-256, persist the digest and byte size in both the object and revision metadata, and verify both on read. Reject duplicate resource paths and bundles over the shared size limit before writing.

Write the R2 revision before its D1 metadata and pointer change. Commit the identity and initial revision, or an appended revision and its conditional pointer update, in one atomic D1 batch. If that batch fails, delete the new object on a best-effort basis and leave the previous pointers unchanged. A failed compensation may leave an unreachable immutable object, never a partially active revision.

Archive an authored skill by marking its D1 identity inactive while preserving its revision metadata and immutable R2 bundles. The partial unique index applies only to active identities, so the same scope-local name can be created again without treating archived records as tombstones.

Do not read, import, update, or delete deterministic R2 documents from ADR 0019. An authored skill exists only when D1 records an active identity and revision pointers. Existing R2-only skills are ignored and must be republished manually into the revisioned format.

Project capability rows continue to grant a skill by its immutable scope-local name. Workspace membership and owner/administrator checks remain outside storage in the existing management seam.

## Consequences

D1 becomes the authority for authored-skill identity and active state, while R2 remains the authority for revision content. Listing no longer depends on R2 object metadata. Runtime catalogue resolution uses stable revisions; draft content cannot affect a conversation until promoted.

The model supports exact provenance and rollback without copying document bodies into D1. It also introduces cross-store orphan cleanup as an operational concern and adds one D1 lookup plus one R2 read when authored instructions are loaded. Deliberately omitting legacy discovery keeps the runtime and storage seam small, at the cost of manually republishing any skills that exist only under deterministic R2 keys.

This decision supersedes ADR 0019's choice to avoid a skill table and overwrite deterministic R2 keys. Its validation, scope, private-storage, project-authorisation, and audit decisions remain in force.
