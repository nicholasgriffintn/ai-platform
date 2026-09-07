# ADR 0018: Run project tasks through governed flows

Status: Implemented.

## Problem

Agent work needs a durable conversation and explicit hand-offs rather than a separate team-delegation runtime. Its progress must also survive retries, compaction and cross-device recovery: a stored tool message preserves a question payload, but a cached message cannot establish whether a decision is still actionable, and persisting a second progress feed would create a competing account of execution.

Saved project flows can change after a task starts, while plan prose and stage order do not prove that work ran.

## Decision

A `project_task` owns an objective, conversation and goal. A project's optional flow names stages, teammates, skills, modes, budgets and approval rules. Run each dispatch through ordinary project chat; do not add a second turn engine.

The runner is the person who starts the task, not the assignee or workspace. Revalidate their membership, project and connections at dispatch. Bind and claim the exact task, project, runner and dispatch tuple; duplicate deliveries must not create another run, and recovery resumes the same conversation. Intersect teammate tools and skills with project grants. Stage and task approval lists are the complete tool approval policy for the run; mode supplies instructions and step limits, not hidden approvals or denials.

Only the execution service queues work. Models cannot set `queued` or `done`. Completed stages persist output, evidence and approval snapshots. Automatic stages advance or finish under the saved policy; human-gated stages create a pending review action. Do not imitate a review gate with `ask_user`. A failed or abandoned dispatch must close or classify its goal rather than leave phantom running work.

Use the project task ID as the stable plan identity and snapshot the selected saved flow when the task is created. Store the exact flow-stage ID on every accepted run, and associate approvals, completions and outputs through that run identity. Derive proposed, executing, completed, failed and interrupted stage state from persisted attempts and results rather than plan position or text. Preserve every attempt and its captured provenance; resume only at existing task-run boundaries known to be safe. A failed run whose external-operation approval was consumed requires provider reconciliation and new work instead of a blind retry, while dispatch failures and failed model-only runs may resume at the same snapshotted stage. Plan inputs change only before execution starts; a completed or abandoned plan with execution evidence cannot be reopened or deleted.

Project the latest current-run question or approval as protocol version 1 `interaction` state on authorised task detail. The flat envelope names the project, task, run and interaction and reports `pending`, `resolved`, `expired` or `interrupted`. Question interactions retain prompts, structured options, written-answer support and acknowledged answers; approval interactions retain the exact tool, reason and resolution. Clients submit to the existing project-task endpoints, which recheck current workspace membership and the exact pending interaction under the conversation lease. A conflict triggers an authoritative refresh, a forbidden response disables resubmission, and a saved decision followed by dispatch failure projects as interrupted rather than failed or rejected. Keep client submission state local and temporary; unknown interaction types render non-actionable.

The same task-detail read returns a newest-first protocol version 1 `activity` projection reconstructed from every run scoped by project and task identity, retained run events, run-keyed message parts, goal progress, the current interaction and task completions — not a progress table. Where a legacy or trimmed run has no retained event for its current state, add a `run.snapshot` item from the run row. Each item carries stable project, task, run and source identities, an open `type`, a stable coarse category and status, safe title, optional summary and detail, time, and actionable and terminal flags. Proposed task outcomes use a null run because they predate execution. Unknown event types remain visible as generic, non-actionable activity, and a new semantic category or incompatible field meaning requires a protocol-version change. The projection excludes assistant reasoning, tool arguments and raw tool results; tool activity names the tool and visible lifecycle only, and completion output is whitespace-normalised and bounded to a short preview.

Use project flows for durable multi-agent sequencing. Team-agent fields remain retired. Delegation is defined separately in ADR 0040 and uses an ordinary child conversation and run; it does not create a second execution runtime. Personal Chat retains bounded `run_council` and `second_opinion` within the caller's turn.

## Consequences

One flow per project is deliberately limited, and former team groupings cannot be migrated automatically into ordered stages. Concurrency caps, token budgets and usage admission must bound unattended work.

Task detail reads all runs for that task with their bounded event journals and messages, which costs more than a final-status read but keeps history coherent across reopening and devices without dual writes. Active project tasks perform an additional authorised detail read at the run polling cadence rather than encoding task authority into the event journal. Existing tasks without a flow snapshot or run-stage identity remain readable under an unattributed task stage rather than being guessed from the current flow.
