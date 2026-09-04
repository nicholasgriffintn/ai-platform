# ADR 0013: Bind connector execution to exact local authority

Status: Accepted.

Dynamic connector schemas and upstream sessions must not become bearer authority for the model or client.

## Decision

Use Composio's configured auth configs and current tool catalogue for Composio recipe connectors. Generate exact toolkit, auth-config and tool identifiers; fetch execution schemas through scoped Session discovery. Use the single `use_recipe_connector` gateway, with no handwritten argument maps or same-provider credential fallback. The GitHub App remains separate sandbox authority.

Keep credentials upstream. Journal Sessions behind opaque local handles bound to the user, run, conversation, recipe, installation, account and exact operation allowlist. Revalidate and atomically claim the stored scope before execution. Prefer the person's selected active account, otherwise the newest eligible one. Close Sessions when the run finishes, not when its client disconnects; a reaper retries unfinished cleanup.

Persist interactive write approvals against the exact stored tool call and argument digest. After approval, revalidate all authority, consume the receipt once, execute, and persist the terminal result before tool-free summarisation. Reuse a persisted result on duplicate delivery. A consumed receipt without a result is indeterminate and requires reconciliation, never automatic re-execution. Scheduled and event-triggered runs cannot obtain approval for gated writes.

Verify webhook signatures over the raw body and enforce timestamp tolerance before parsing. Match events to an active local trigger, installation and account, then enqueue idempotently in the original scope. Event text remains untrusted input.

Bridge files through authorised private Sources and Outputs and bounded Session mounts. Persist governed Outputs, not upstream URLs. Keep arguments, results, credentials and upstream Session IDs out of Activity metadata.

## Trade-off

Exact approvals and durable cleanup add storage and a second request. A crash between execution and result persistence cannot be resolved safely by retry alone. See the [operator guide](../../operations/composio-connectors.md) for setup and recovery.
