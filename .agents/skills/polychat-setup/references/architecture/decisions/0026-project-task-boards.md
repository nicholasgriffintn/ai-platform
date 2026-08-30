# ADR 0026: Project agent operations

## Status

Accepted

## Context

Work had every noun except the one that matters most. A project owned instructions, capabilities, sources, outputs, conversations, activity, and audit — transcripts and results, with nothing between them holding intent in progress. Wanting the assistant to do five things meant opening five conversations, and the state of each lived in scrollback somebody had to remember to reopen.

The runtime for this already existed and was mostly idle. A goal (ADR 0022's finish gate, `evaluateGoalContinuation`) is already an objective an agent works towards autonomously, with an iteration ledger, evidence entries, and one shared stall rule — but it hides inside a single conversation and is invisible to everyone else in the project. Turns already outlive the connection (ADR 0024). `RecipeExecutionHandler` and the inbound channel service already run a turn from a queue entry, as a specific user, in a project conversation.

Approvals were the sharpest version of the problem. Connector operation receipts, `request_approval`, and `AGENT_MODE_CONFIGS.requiresApprovalFor` all surface inside one thread. Five runs in flight means five silently blocked threads and nothing telling anybody.

Two prior attempts at multi-agent work stopped short of this. `runPanel` (ADR 0021) already routes between named roles with a hard turn budget and a routing contract that stops rather than guessing. `TeamDelegation` already has team roles, cycle detection, depth limits, and a rate limit. Neither persists a run: a council debate is a tool result inside one message, and a delegation is a nested `getAIResponse` folded into the caller's turn. Both call the provider directly rather than going through the turn engine.

## Decision

Make the unit of work in Work a **task**: a durable, project-scoped objective that carries its own conversation and goal.

Persist it as `project_task`, namespaced to avoid the existing `tasks` queue table. Present it as an operations queue rather than a configurable project-management board: lifecycle state, agent activity, pipeline progress, and work needing attention are the primary information. A project may define one **flow** whose ordered stages name instructions, an agent, zero or more attached skills, a mode, an approval policy, and an advance rule. A completed automatic stage queues its successor; a review stage stops for human acceptance. A stage's approval policy is unioned with its mode's rather than replacing it, so a stage can raise what needs a person's say-so but never lower it.

Project conversations receive the task tools as part of the Work contract rather than as optional project-library tools. They may create, inspect, list, and update work, but only a person may accept a reviewed task as done. A task run receives the same tools so its conversation can inspect its exact task and leave the queue in a truthful state; normal permission and approval policy still applies to writes.

**The model never queues work or reaches `done`.** Queueing creates a real internal dispatch, and only the execution service may perform that transition. A completed goal projects to the next automatic stage or to `review`; only a person accepts the final result. `PROJECT_TASK_ACTOR_TRANSITIONS` encodes this at the tool and service boundaries.

**Runner identity is the person who starts the run**, never the assignee and never the workspace. Connector authority is user-owned (ADR 0012), so a task needing an unconnected provider blocks with a message naming the person who must connect it rather than borrowing another member's credentials. The queue handler re-resolves that user, their current workspace membership, and the project before it runs anything, because a queue entry is not proof of authorisation.

A run is an ordinary project conversation turn through `handleCreateChatCompletions` with `metadata.project_id`. There is no second way to run a turn (ADR 0022): the goal gate, tool execution, approvals, usage limits, and cancellation all apply unchanged. Before enqueueing, the repository binds one generated dispatch id to the project task. The handler claims only the exact task, project, runner identity, and dispatch tuple, so stale or duplicated deliveries cannot run a different task. The operations surface only sets work up and projects its result.

When missing information prevents progress, the runner calls `ask_user` with one to three structured questions rather than ending with questions in prose. A pending question is a deliberate goal boundary: the goal becomes blocked, the task projects `awaiting_input`, and the task conversation shows the same durable questionnaire above its composer and in the message history. The response endpoint validates that the answers belong to the latest pending interaction, records them as a user message, resolves the tool result, and queues the same task and conversation to resume. The recent-conversation list and task actions project this state as “waiting for your answers”; they do not infer it from assistant text.

A queue dispatch is synchronous from the runner's perspective even though it was started in the background. Once that dispatch returns, its goal must be terminal or intentionally blocked. Provider and execution failures close the goal before the task becomes retryable, and an otherwise active goal is marked stalled rather than being left as phantom work.

Make agents a project capability kind. A flow stage naming an agent reuses a persona that already has a table, an editor, and a marketplace, rather than inventing a parallel role concept. An attached agent keeps its persona but not its tool authority: `enabled_tools` are **intersected** with the project's effective tools, never unioned, so attaching a personal agent cannot widen what a workspace reaches. Only an agent's owner may attach it.

Aggregate attention. `/workspaces/attention` returns blocked, in-review, and self-assigned tasks across every workspace the caller belongs to, resolved from their memberships rather than any client-supplied id.

## Trade-offs

Unattended agent loops are a spend multiplier, and an operations queue makes it easy to start many. A per-project concurrency cap and a per-task token budget ship with the first runnable version rather than later; usage exhaustion moves a task to `blocked` instead of burning quietly. This is the risk to watch, not a theoretical one.

An operations queue can drift into generic project management. There are deliberately no due dates, estimates, reports, or swimlanes: this is about what agents are doing, and a task with no runner is only captured intent.

One flow per project, stored as JSON on `project` and captured by project templates. Multiple flows would need a table; if that arrives, this column becomes a migration.

No Durable Object. ADR 0024 kept them out of chat deliberately, so the operations surface polls with React Query — fast while something runs, once a minute otherwise. Live updates are the first thing to revisit, and `ConversationCoordinator` is where that would live.

`runPanel` and `TeamDelegation` still bypass the turn engine. That is real ADR 0022 debt, but coupling its repair to this task system would double the risk of both. It stands, named, as separate work.

The sandbox and recipe runners are specified in `projectTaskRunnerKindSchema` as a single `conversation` variant for now. The goal owner union already accepts a sandbox run id, so the second runner is a small addition rather than a redesign — but it is not built, and neither is a personal-scope task system under Chat.
