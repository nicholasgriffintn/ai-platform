# ADR 0019: Store authored skills as scoped R2 documents

## Status

Accepted

## Context

ADR 0018 deliberately deferred persistence until user-authored skills created a real second source. That source now needs authenticated personal ownership, project publishing governance, validation of untrusted `SKILL.md`, and runtime loading.

A dedicated database table would duplicate the Markdown body and create another lifecycle beside object storage and `project_capability`. Skills are documents, their Agent Skills name is already a stable scope-local identity, and R2 supports prefix listing plus small object metadata.

## Decision

Keep user-authored `SKILL.md` in the private R2 bucket as the canonical record. Use deterministic keys:

- `skills/users/{userId}/{name}/SKILL.md` for personal skills;
- `skills/projects/{projectId}/{name}/SKILL.md` for published project skills.

Store the parsed description, creator ID, and timestamps as R2 custom metadata. List personal skills from the authenticated user's prefix. A skill name is immutable within its scope; renaming is delete-and-create.

Do not add a skill table. Project `project_capability` rows remain the authoritative publication and runtime grant, and workspace audit records capture publish, update, and unpublish events. Publishing and mutation require project owner or administrator access; all project members may read a published skill.

Validate every authored document before storage. Enforce the Agent Skills frontmatter shape and size bound, reserve `polychat-*` metadata for built-ins, reject built-in name collisions, and continue treating `allowed-tools` as descriptive metadata rather than authority. Label loaded authored content as user-authored and resolve it only inside its authenticated personal or project scope.

## Trade-offs

R2 and D1 cannot participate in one transaction. Project publishing writes the object first, adds the capability grant second, and deletes the object if the grant fails. Unpublishing removes authority first; an object-deletion failure can leave an inaccessible orphan and is logged for operational cleanup.

Deterministic keys make updates simple overwrites and do not retain version history. Add versioned objects only when revision history becomes a product requirement.

R2 metadata is intentionally a small discovery projection, not another schema. Future skill resources can live below the same scope/name prefix without changing the ownership model.
