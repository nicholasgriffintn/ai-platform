# ADR 0013: Bind Composio sessions, approvals, and events to exact local authority

## Status

Accepted

## Context

Composio Sessions make dynamic discovery, execution, file mounts, and connection management available through one upstream object. Passing an upstream Session ID between model turns would make it a bearer capability, however, and request-local cleanup alone cannot recover Sessions left by Worker termination.

Connector writes and inbound events widen the same authority boundary. A generic approval can be replayed against changed arguments or another account, while a validly signed webhook is still untrusted external data and must not select an arbitrary recipe installation.

## Decision

Generate one connector run ID in the server request context. Persist every tool Session under an opaque local handle with its upstream ID, user, completion, recipe and installation scope, provider, toolkit, auth config, selected connected account, exact operation allowlist, expiry, and cleanup state. Return only the local handle. Claim it atomically before execution, verify the full immutable scope, and delete the upstream Session from every normal chat completion path. Persist hosted credential connection-management Sessions in the same cleanup journal. Lease expired or cleanup-pending records in the scheduled reaper and retry failed upstream deletion.

Keep Composio credentials and connected accounts upstream. Store only user-owned account aliases and the explicitly selected account locally. If no active selected account exists, use the most recently connected eligible account for compatibility.

Classify operations from the generated Composio metadata using read-only, destructive, idempotent, and open-world hints. Disable multi-execute, workbench, and proxy execution. Polychat exposes only its governed single-tool execution path.

Represent interactive write authority as a short-lived approval receipt bound to an authenticated, persisted conversation and tool-call boundary. Treat client messages as untrusted for execution. After resolution, load the stored pending call and revalidate the user, connector run, completion, provider, exact operation, SHA-256 argument digest, Session, selected account, recipe, installation, and project scope before atomically consuming the receipt and executing once. Persist the terminal tool result before asking the model to summarise it, and disable tools for that summary. A duplicate request for a consumed receipt reuses the stored terminal result; if the receipt was consumed but no result was persisted, fail closed and report the execution as indeterminate rather than executing again. Do not offer approval for scheduled or event-triggered writes.

Keep approval receipts, run scope, message-state projection, and cleanup provider-neutral. Let connector adapters declare stored-action approval support; shared policy must not branch on Composio authentication types. Keep the Session journal Composio-specific because it persists upstream Session, toolkit, auth-config, mount, expiry, and remote-cleanup semantics that other connector implementations do not share. Introduce a broader persistence interface only when a second adapter supplies the same lifecycle. Project authoritative approval state onto stored chat responses so a reloaded client renders resolved, consumed, or expired state instead of recreating action controls from the original pending payload. Delete unresolved receipts when their execution window ends, but retain resolved receipts for 30 days so recent conversation history preserves its decision and completion state.

Treat `/webhooks/composio` as an unauthenticated but cryptographically authenticated ingress. Verify the HMAC over the raw body, webhook ID, and timestamp before parsing JSON, enforce a five-minute timestamp tolerance, then match the event to one persisted active trigger and active recipe installation. Build an idempotent task ID from the event and trigger IDs, preserve user and project scope, cap the payload embedded in the recipe input, and label every event field as untrusted data.

Bridge connector files only through authorised private Sources and Outputs and the Session `files` mount. Apply bounded size and time limits, validate filenames, paths, MIME types, and presigned hosts, and import explicit mount descriptors as governed Outputs in the conversation and project scope. Do not return Composio or object-store URLs as durable results.

Project connector operations into Activity records using local run, completion, installation, account, session-handle, and upstream log identifiers. Do not record operation arguments, result bodies, credentials, or upstream Session IDs in activity data.

## Trade-offs

The local journal and reaper add D1 writes and scheduled maintenance to every Composio run, but make expiry, retries, correlation, and crash recovery explicit. Exact approvals require durable conversation history and a second authenticated request after the user decides, but prevent the client or model from changing the approved action. A crash between receipt consumption and terminal-result persistence is deliberately indeterminate and requires operator reconciliation instead of automatic re-execution.

Event triggers depend on correct webhook-secret rotation and Composio delivery. Deterministic task IDs suppress duplicate delivery, but operators still need to inspect trigger state and upstream logs when an accepted event does not run. File bridging adds storage and transfer cost and deliberately rejects large files or unexpected hosts.
