# ADR 0009: Use scoped resources and explicit authority

Status: Accepted.

Avoid parallel stores and inconsistent access rules for the same inputs, results and configuration.

## Decision

Use **sources** for durable inputs, **outputs** for results, **templates** for reusable configuration, **activity** for execution history, and immutable **audit records** for governed workspace changes. A source or output is personal without a project and collaborative with one. Conversation links are provenance, not authority.

Keep file bytes private. Authorise source/output access on the server; output shares use hashed, expiring, revocable tokens. Do not publish project conversations through personal conversation sharing. Use the owning service's creator and administrator mutation rules rather than inferring write permission from read access.

Store validated settings in `capability_configuration`, keyed by scope, capability kind and ID. Configuration does not enable a capability. `project_capability` owns project associations; app and recipe associations are member-created and creator-managed, while project tools remain administrator-managed.

Keep recipe installations user-owned, including their project ID and creator. Members can see project installations; only their creator changes them. Scheduled execution retains user and project scope and resolves that person's current connections. Owners and administrators curate the reserved project context collection; the memory service owns memory retrieval and writes.

Validate project templates against current catalogues before atomic creation. Transfer workspace ownership atomically and require transfer before an owner leaves. Retain workspace audit history after deletion; record the deletion request before removing collaborative content and memberships.

## Trade-off

Polymorphic scopes and separate D1/R2 stores require explicit cleanup. Retained audit records may reference deleted workspaces. Provider connections remain personal; shared credentials must not emerge accidentally from project configuration.
