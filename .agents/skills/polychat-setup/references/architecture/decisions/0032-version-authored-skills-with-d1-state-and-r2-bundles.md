# ADR 0032: Load skills on demand and version authored content

Status: Accepted.

Specialised instructions should not inflate every prompt, and editing them must not silently change the revision a conversation is using.

## Decision

Use Agent Skills documents: disclose a ready skill's name and triggering description, then load its body or exact resource through `load_skill`. Keep built-ins under `apps/api/src/data-model/skills`, explicitly registered in its index. Skills teach methods; tools provide capabilities. General safety and instruction precedence stay in the main prompt.

Treat portable `allowed-tools` as metadata, not authority. Built-in requirements and suggested tools remain subject to scope, permission and approval checks. Personal opt-outs are curation; project skill attachment is authority; always-on skills follow their explicit product contract. Treat authored documents as untrusted and reserve `polychat-*` metadata for built-ins.

Give authored skills D1 identity, revision metadata and compare-and-swap draft/stable pointers. Store each complete immutable revision as a private R2 bundle with canonical paths, size and integrity digest. Write R2 first, then commit D1 state atomically; compensate failed D1 writes without moving the prior pointers. Archive identity without erasing revision history.

Runtime and ordinary project-member reads use stable revisions. Owners and administrators govern project drafts, promotion, history, rollback and imports. Promotion targets the current draft; rollback and import create revisions with lineage. Immediate-update routes retain their activation semantics.

Pin the stable revision for one request, but revalidate ownership, membership and enablement on every load. Persist safe revision provenance with loaded results. Legacy mutable R2-only documents are not discovered and require manual republishing.

## Trade-off

Skill loading costs a tool call and the model may ignore optional guidance. D1/R2 writes cannot share a transaction, so failed compensation can leave unreachable objects. Versioning adds reads but makes instruction provenance and rollback possible.
