# ADR 0012: Use Composio's configured catalogue as recipe connector authority

## Status

Accepted.

## Context

Recipe connectors previously duplicated OAuth clients, token storage, refresh, account state, argument mapping, and provider execution inside Polychat. A hand-maintained subset of Composio would repeat the same problem: tool versions and schemas would drift, configured auth configs could be omitted, and similar connectors would expose inconsistent capabilities.

## Decision

Call Composio's versioned REST API directly without an SDK. Treat the enabled auth-config list, each auth-config detail, and the current non-deprecated tool catalogue as the only source for Composio recipe connectors.

Generate a minified JSON index containing every enabled auth config, exact toolkit slug, current toolkit version, exact tool slug, scopes, catalogue metadata, and read/write annotation. Group multiple auth configs under their exact toolkit slug and retain their real IDs; do not create provider aliases, compatibility identifiers, handwritten argument maps, or curated tool subsets. Do not embed tool input and output schemas in the generated index.

At runtime, build the fast provider catalogue and capability guard from that index. Register one stable `use_recipe_connector` function, not one Polychat function per Composio tool. The function creates a user, toolkit, auth-config, account, and recipe-operation scoped Composio Session. It uses Session search to return the current authoritative schemas for a requested use case, then verifies the session owner and scope before executing the selected exact tool. Arguments pass to Composio unchanged.

Use the Connected Accounts link endpoint for Composio-managed OAuth setup. Use a connection-management Session link for configured credential schemes that require hosted input. Bind connection listing, callback completion, execution, revocation, and deletion to both the namespaced Polychat user and the generated auth-config IDs.

When several eligible active accounts exist for one toolkit, pin the Session to the most recently connected account. This matches Composio's single-account Session behaviour while keeping execution deterministic. Ignore duplicate account IDs returned across paginated account reads.

Expose every configured toolkit through purpose-specific recipe workflows alongside similar connectors. A workflow's allowlist contains the complete generated operation catalogue for its included toolkits. Scheduled execution remains read-only and interactive writes retain approval requirements.

Require Composio's project-level callback identity verifier for deployed OAuth flows. Keep the callback route authenticated, redact its single-use `session_uri`, accept only Composio hosted-link URLs, and isolate Composio identities with a stable deployment namespace. For local Connect Link testing, also accept Composio's documented `status` and `connected_account_id` callback, then fetch that exact account under the signed-in namespaced user and require its toolkit, auth config, owner, and active status to match. Do not add a local boolean that duplicates the project setting.

Remove manual OAuth recipe connectors that are not enabled in Composio and purge their stored credentials. Keep only local API-key connectors whose capabilities remain outside the configured Composio catalogue. The GitHub App remains a separate sandbox authority, not a recipe connector fallback.

## Trade-offs

The checked-in generated index makes deployments reproducible and reviewable, but dashboard changes require a synchronisation and deployment. Retaining every exact tool slug still has a size cost, but schemas and tool descriptions are resolved only after the model chooses a connector and use case. Direct REST keeps the dependency surface small but leaves Polychat responsible for API validation, pagination, error translation, callback verification, session scoping, and generation checks.

The migration is deliberately breaking. Existing users reconnect, and a Composio outage affects connector listing, setup, and execution. There is no fallback to deleted credentials or bespoke provider executors.
