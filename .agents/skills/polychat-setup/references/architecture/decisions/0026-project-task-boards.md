# ADR 0026: Run project tasks through governed flows

Status: Accepted.

Give agent work a durable conversation and explicit hand-offs instead of a separate team-delegation runtime.

## Decision

A `project_task` owns an objective, conversation and goal. A project's optional flow names stages, agents, skills, modes, budgets and approval rules. Run each dispatch through ordinary project chat; do not add a second turn engine.

The runner is the person who starts the task, not the assignee or workspace. Revalidate their membership, project and connections at dispatch. Bind and claim the exact task/project/runner/dispatch tuple; duplicate deliveries must not create another run, and recovery resumes the same conversation.

Intersect agent tools and skills with project grants. Stage and task approval lists are the complete tool approval policy for the run; mode supplies instructions and step limits, not additional hidden approvals or denials. Account, membership, capability and connector checks still apply.

Only the execution service queues work. Models cannot set `queued` or `done`. Completed stages persist output, evidence and approval snapshots. Automatic stages advance or finish under the saved policy; human-gated stages create a pending review action. Do not imitate a review gate with `ask_user`.

Project `awaiting_input` and `awaiting_approval` only from exact durable pending interactions. Answers resolve that interaction once and resume the same task. A failed or abandoned dispatch must close or classify its goal rather than leave phantom running work.

Use project flows for durable multi-agent sequencing. Team-agent fields and nested delegation are retired. Personal Chat retains bounded `run_council` and `second_opinion` within the caller's turn.

## Trade-off

One flow per project is deliberately limited. Former team groupings cannot be migrated automatically into ordered stages. Concurrency caps, token budgets and usage admission must bound unattended work.
