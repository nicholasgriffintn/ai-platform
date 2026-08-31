# ADR 0027: Project flow approval authority

## Status

Accepted

## Context

Project task stages already save their tool approval policy, but task execution also applied the selected conversation mode's denials and approval defaults. That created two conflicting authorities. Plan silently blocked network, delegation, and even human questions; Build asked for approvals the flow did not require; failed calls then repeated because the model could not distinguish policy from a transient tool error.

Questions and approvals were also projected from goal status rather than an exact pending interaction. A model could write a question in prose or submit blocked evidence and leave a task labelled as waiting for approval even though a person had no control that could resume it.

## Decision

For a project task run, the saved stage and task `requiresApprovalFor` values are the complete tool approval policy. The stage mode still selects instructions and step limits, but it adds no hidden tool denials or approvals. Premium, sign-in, project capability, membership, and connector authority checks remain unchanged.

A permission that requires a person's decision creates one durable pending tool interaction. Tool approval records the exact tool and call; `ask_user` records one to three structured questions. The task projects `awaiting_approval` or `awaiting_input` only from the corresponding unresolved interaction and resumes the same conversation from that exact response.

Human input is never represented by a blocked evidence ledger or a question written in assistant prose. A project task may submit blocked goal evidence only for a recorded failing tool dependency. Otherwise it must call `ask_user`. The runner treats an unclassified blocked goal as stalled rather than inventing an approval.

The flow owns stage hand-off. A task run does not expose nested delegation tools already represented by the next stage, and a completed automatic stage queues its successor only after producing the stage deliverable and satisfying its goal evidence.

The queue delivery owns execution recovery. A first delivery may claim only queued work; a redelivery may reclaim the same durable dispatch from `running`, close the abandoned execution record, and resume the same project task conversation and goal. Ordinary duplicate deliveries remain no-ops.

## Consequences

- Flow authors can see the complete approval policy in the saved project configuration.
- Plan and Review may use read-only network tools when the stage permits them; Build requests approval only for permission classes explicitly saved on the stage or task.
- Questions and approvals survive reloads and can be answered exactly once.
- Providers may emit common legacy question argument names, which the API normalises at the tool boundary before validating the canonical question contract.
- An interrupted Worker delivery no longer leaves the task and goal permanently active, while a duplicate first delivery still cannot start a second run.
- Existing historical transcripts keep their recorded errors, but new task runs use the corrected policy and interaction state.
