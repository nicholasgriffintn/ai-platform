# ADR 0043: Version lossless chat input rewriting by scope

## Status

Accepted. Extends ADR 0017 without changing provider execution governance in ADR 0040.

## Context

JSON tool results can waste model context on presentation whitespace. Rewriting conversational text or reserialising parsed JSON risks changing meaning, large numbers, duplicate keys, signed content, or the evidence retained in history. Administrators need to preview and reverse changes without a concurrent save silently overwriting their work.

## Decision

Keep rewriting Off by default. Offer one deterministic rule that validates JSON and removes only JSON whitespace outside strings, preserving the original lexical values. Apply it to eligible plain-string tool results at the shared chat provider boundary; retain the original messages in storage.

Store one `chat_input_policy/default` record per user or project in `capability_configuration`. Reserve that key in the repository storage type without publishing it as a capability. Let a dedicated service own authorisation, validation, atomic revision comparison, and the last 20 policy revisions. Project policy belongs to owners/admins and never inherits the runner’s personal setting.

Use the same transform for a read-only preview. Log the applied revision and number of changed messages without message contents. Describe token savings as estimates and retain provider-reported usage for billing.

## Consequences

The first rule is predictable and reversible, with no database migration or external model call. Savings are limited to JSON formatting, and revision history is deliberately bounded rather than an immutable audit ledger. Independent provider capabilities, sandbox execution, and training do not pass through this chat-specific transform; the setting makes no provider-governance assurance.
