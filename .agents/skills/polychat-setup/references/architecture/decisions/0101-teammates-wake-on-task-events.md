# ADR 0101: Teammates wake on task events and leave a trace

Status: Implemented.

## Problem

Teammates in Work only ran when a person started a task. Nothing woke a teammate when work was assigned to it, when someone mentioned it, when a blocker cleared or when a review was waiting, and nothing noticed a teammate that ran and left no record of what happened. Without that, teammates cannot manage work between people's prompts, and a quiet failure looks the same as progress.

## Decision

A teammate wakes for a reason: assigned, mentioned, review requested, blocker cleared, escalation, standup, setup or its own heartbeat. A wake for a task the teammate owns starts that task through the ordinary start path. Any other wake queues a `work_teammate_wake` task for the person responsible for the teammate, and the run goes through ordinary teammate admission in a conversation bound to the project, with a brief listing its own tasks, reviews, its reports' blocked work and, for the lead, untriaged cases. Identical wakes within a short quiet period are dropped.

A teammate employed in a workspace has one teammate context scoped to that workspace, not one per project. Its memory and connection grants are carried over from its project contexts when the workspace context is first made, and it covers runs in any project of that workspace. Employment is what grants the Work tools: a run in a workspace context gets them whatever the teammate's own tool list says, and they act inside the run's project only.

A teammate's questions and recoverable failures go to its manager before any person. When a task owned by a teammate with an active teammate manager stops on questions, a stall, a missing capability, a failed run or a kill condition, the manager wakes with the questions and nothing is delivered to people. The manager answers with `answer_questions`, sends the work back, or escalates once with what it knows and exactly what is missing. Approvals, computer takeovers, spend limits and escalations to a person always go straight to people. The workspace lead is available in every project of its workspace.

Heartbeats are a per-teammate cadence on the workspace record, checked by the Work rhythm schedule alongside budget review and standups. Every run is expected to end with an update, a status change or a named blocker. A watchdog checks each wake after a grace period, and when the teammate touched nothing it records an escalation on the focus task to the teammate's manager, or to the responsible person when it has none.

Budgets apply per teammate across the workspace. At 80% of its monthly cap a teammate shows a warning in Inbox, and at 100% it pauses and no new run starts until someone raises the cap.

## Consequences

Teammates can move work forward unattended without new authority: every run still borrows a named person's membership and grants, and every wake has a recorded cause. Wakes cost credits, so frequent heartbeats or standups for many teammates show up on the Costs page and against each teammate's cap.
