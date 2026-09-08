# ADR 0039: Set permission mode on the conversation

Status: Implemented for the conversation control, persistence and request contract; agent runtimes that consume the mode are not released.

## Problem

A provider that writes files and runs commands needs a permission policy. ADR 0029 recorded that per-action approval alone "will not survive daily use unchanged, so the interaction needs its own design pass rather than a later loosening of the rule". A first run under per-action approval is fifteen prompts long, and the predictable response to that is a standing account-wide grant — the one decision worth keeping, given away permanently and out of sight of the work it applies to.

## Decision

Four modes, stored on the conversation: `supervised` asks before commands and file changes, `auto_accept_edits` lets file changes flow while commands ask, `auto` defers to the provider's own routine-versus-unusual triage where it has one, and `full_access` gates nothing. The control sits in the composer settings beside reasoning effort and verbosity, and appears only when the selected provider declares `writesFiles` or `runsCommands`.

Default to `auto_accept_edits`. Edits are what was asked for and are recoverable from the recorded starting revision; commands are the part that reaches outside the directory. Both neighbours are one setting away.

A branch inherits its parent's mode rather than the column default, on the server as well as the client, so continuing a supervised conversation cannot quietly loosen it.

Degrade from declared capabilities, never from a driver name. A provider that does not report its own review cannot offer `auto`; a provider that cannot raise an approval request cannot offer the gating modes. An unavailable mode is shown as unavailable with its reason where the mode is chosen, and a request naming one is refused rather than run as a different mode than the one displayed. A mode change applies from the next run.

No account-wide standing grant exists. A mode belongs to a conversation, and that is the whole scope. Approvals continue to arrive inline through the existing run-instruction rail, which already carries approval requests and responses with idempotency keys and escalation windows.

## Consequences

A person can loosen or tighten permissions where the work is, without a separate grant surface to audit, and the setting travels with a branch. Choosing `full_access` still leaves a provider free to ask, and the control says so, so the mode is a ceiling rather than a promise.

Providers differ visibly: the same conversation offers different modes depending on what the selected provider declares, and a provider that reports no approvals cannot be supervised at all. Refusing an unavailable mode rather than substituting a safer one means a saved conversation can stop accepting runs after a provider's declared capabilities change, which is the honest failure and the one a person can act on.
