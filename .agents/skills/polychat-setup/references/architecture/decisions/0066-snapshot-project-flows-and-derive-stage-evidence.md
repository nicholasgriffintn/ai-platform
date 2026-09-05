# ADR 0066: Snapshot project flows and derive stage evidence

## Problem

Saved project flows can change after a task starts, while plan prose and stage order do not prove that work ran. Reconstructing progress from the current flow can rename or reorder history, and retrying a failed stage without considering earlier external effects can duplicate irreversible work.

## Decision

Use the project task ID as the stable plan identity and snapshot the selected saved flow when the task is created. Store the exact flow-stage ID on every accepted run, and associate approvals, completions and outputs through that run identity. Derive proposed, executing, completed, failed and interrupted stage state from persisted attempts and results rather than plan position or text.

Preserve every attempt and its captured provenance. Resume only at existing task-run boundaries that are known to be safe. A failed run whose external-operation approval was consumed requires provider reconciliation and new work instead of a blind retry. Dispatch failures and failed model-only runs may resume at the same snapshotted stage.

Allow plan inputs to change only before execution starts. Cancelling an untouched task can return it to the backlog, but a completed or abandoned plan with execution evidence cannot be reopened or deleted; create a new task so its earlier attempts and completed stages remain attributable. Pending stages on an abandoned plan stay visibly abandoned while completed stages retain their results.

## Status

Implemented.

## Consequences

Web and iPhone can navigate from a stage to its exact run conversation and durable outputs, and retries retain separate provenance. Existing tasks without a flow snapshot or run-stage identity remain readable: their attempts appear under an unattributed task stage rather than being guessed from the current flow. The existing project-task runner remains the only durable Work runtime; this does not introduce child agents or a second execution model.
