# ADR 0058: Project native task decisions from authoritative interaction state

Status: Accepted.

Stored tool messages preserve question and approval payloads, but a cached message cannot establish whether a decision is still actionable. Native clients also need to distinguish a failed submission from a decision that the server accepted before task continuation failed.

## Decision

Add protocol version 1 `interaction` state to authorised project-task detail. The flat envelope names the project, task, run and interaction, and reports `pending`, `resolved`, `expired` or `interrupted`. Question interactions retain prompts, structured options, written-answer support and acknowledged answers. Approval interactions retain the exact tool, reason and approved or rejected resolution. The latest interaction is returned only when it belongs to the task's current run.

Keep client submission state separate. iOS reports idle, submitting, retryable or non-retryable failure, acknowledged locally and resolved elsewhere. It submits question answers or approval decisions to the existing project-task endpoints, which recheck current workspace membership and the exact pending interaction under the conversation lease. A conflict triggers an authoritative refresh; a forbidden response disables resubmission. A saved decision followed by dispatch failure projects as interrupted rather than failed or rejected.

Poll task detail alongside exact-run replay while the run is active, and once when opening a terminal project run. Streamed tool results retain their structured data in native message parts, but the task-detail projection decides whether the card can act. Unknown interaction types render a non-actionable update-and-refresh state.

Personal connector approvals use their existing exact approval ID rather than the project interaction envelope. An owner-scoped status read returns the bound run, conversation, provider, operation and lifecycle. iOS resolves that exact approval, continues only an approved unconsumed operation with the same approval ID, and reconciles a conflicting decision or expiry before offering another action.

Represent a task destination as the stable tuple `(workspaceId, projectId, taskId, conversationId?)`. G13 may map that tuple to notification deep links without making a message ID or cached card authoritative. G09 and G15 may extend presentation around the same interaction and run identities rather than creating another task-control store.

## Trade-off

Active project tasks perform an additional authorised detail read at the two-second run polling cadence. This avoids encoding task authority into the event journal or duplicating decision state in iOS. Older clients ignore the additive detail field, and newer clients treat its protocol version and unknown types conservatively.
