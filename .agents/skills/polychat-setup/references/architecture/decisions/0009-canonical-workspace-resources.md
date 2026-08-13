# ADR 0009: Canonical workspace resources

## Status

Accepted

## Context

Personal chat and Work accumulated separate persistence models for app data, dynamic app responses, uploaded assets, memories, recipe installations, connector credentials, and sandbox runs. Similar records had different access rules and response shapes, while project capabilities needed collaboration, governance, and eventual desktop access without another parallel model.

Keeping compatibility repositories or dual writes would preserve ambiguous ownership and make migrations impossible to reason about. Raw public app-data share tokens also could not be migrated safely into a hashed-token model.

## Decision

Use one vocabulary across personal and project contexts:

- store generated and user-authored results as **outputs**;
- store files, memories, URLs, text, connected records, and repositories as **sources**;
- store encrypted external authority as user-owned **provider connections**;
- store reusable personal or workspace configuration as **templates**;
- project execution history into **activity records**; and
- record governed workspace mutations as immutable **audit records**.

Outputs and sources are personal when `project_id` is null and collaborative when it is set. A conversation link adds provenance, not authority. Project membership controls project reads; creators may mutate their own project resources, while admins and owners may govern all project resources. File bytes remain private and are exposed only through authorised source/output routes or an active output share.

Output shares use random tokens whose SHA-256 hashes are persisted. Shares may expire or be revoked, and project share changes are audited. Public conversation access may expose conversation-linked files, but project conversations cannot use personal conversation publishing.

Project templates validate capability references and tool configuration against the current catalogues before creating the project and all associations in one database batch. Workspace ownership transfer changes both memberships atomically, and an owner cannot leave before transfer.

Migrate legacy data through temporary staging tables, populate the canonical tables, then remove `app_data`, `stored_asset`, memories, memory groups, recipe-installation records, legacy connection records, and their runtime repositories/routes. Retire legacy raw-token app shares instead of preserving unsafe token material. Do not add compatibility APIs or dual-write paths.

## Trade-offs

This is a deliberate breaking replacement. Old app-data and asset URLs, response fields, and raw app share links stop working after migration. Existing records remain available through their canonical resource type, but callers must adopt the new contracts.

Connections remain user-owned even when used inside Work because upstream consent and credentials belong to a person. Workspace-owned service accounts would require a separate secrets and consent decision.

Activity is a user-facing projection rather than an immutable compliance log; audit records serve governance history. Desktop clients can later consume the same contracts without changing ownership semantics.
