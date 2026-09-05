# ADR 0062: Expire readiness and make model handoffs explicit

## Problem

Model and capability availability depends on current account, plan, provider credentials, project membership and turn policy. A client-side catalogue snapshot can become stale, and silently replacing a selected model hides both an access reversal and a change in execution identity.

A model change also has different consequences depending on the current run, pending interaction, conversation history and composer attachments. Treating every change as equivalent can strand an approval or discard context without telling the user.

## Decision

Use the existing model and capability catalogues to publish protocol-versioned readiness with `ready`, `setup_required`, `unavailable` and `unknown` states, an actionable reason, and bounded `checkedAt` and `expiresAt` timestamps. Unknown means the check failed; it is not permission to execute. Every model and capability invocation still resolves current server-side authority at its I/O boundary.

Do not substitute another model when a saved selection disappears or becomes non-executable. Web and iOS retain the selection, explain the account or provider problem and require an explicit replacement. Provider changes invalidate cached readiness, and expired model readiness is refreshed or blocks submission.

A model selection applies to the next run. Compatible composer attachments and stored conversation history remain available, while model-specific response settings reset. Model changes are blocked while a run or its approval/question is active and when current attachments are incompatible. A one-turn image generator requires a new conversation when history already exists.

Use a conversation branch for a separately navigable alternative and the existing multi-model response path for an in-place comparison. Each alternative keeps its own message/model attribution, run identity and usage records; changing the selected model does not relabel earlier results.

## Status

Implemented.

## Consequences

Clients gain honest failure and reversal states at the cost of occasionally requiring a refresh or explicit model choice. Readiness improves preflight guidance but never weakens server authorisation. Active interactions remain bound to the run that created them, and unsupported transfers fail before submission with a remediation path.
