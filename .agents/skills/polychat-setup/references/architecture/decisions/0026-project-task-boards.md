# ADR 0026: Project task boards

## Status

Accepted

## Context

Work had every noun except the one that matters most. A project owned instructions, capabilities, sources, outputs, conversations, activity, and audit — transcripts and results, with nothing between them holding intent in progress. Wanting the assistant to do five things meant opening five conversations, and the state of each lived in scrollback somebody had to remember to reopen.

The runtime for this already existed and was mostly idle. A goal (ADR 0022's finish gate, `evaluateGoalContinuation`) is already an objective an agent works towards autonomously, with an iteration ledger, evidence entries, and one shared stall rule — but it hides inside a single conversation and is invisible to everyone else in the project. Turns already outlive the connection (ADR 0024). `RecipeExecutionHandler` and the inbound channel service already run a turn from a queue entry, as a specific user, in a project conversation.

Approvals were the sharpest version of the problem. Connector operation receipts, `request_approval`, and `AGENT_MODE_CONFIGS.requiresApprovalFor` all surface inside one thread. Five runs in flight means five silently blocked threads and nothing telling anybody.

Two prior attempts at multi-agent work stopped short of this. `runPanel` (ADR 0021) already routes between named roles with a hard turn budget and a routing contract that stops rather than guessing. `TeamDelegation` already has team roles, cycle detection, depth limits, and a rate limit. Neither persists a run: a council debate is a tool result inside one message, and a delegation is a nested `getAIResponse` folded into the caller's turn. Both call the provider directly rather than going through the turn engine.

## Decision

Make the unit of work in Work a **task**: a durable, project-scoped objective that carries its own conversation and goal.

Persist it as `project_task`, namespaced to avoid the existing `tasks` queue table. Board columns are the task's own lifecycle — backlog, queued, running, blocked, review, done — because status is intrinsic and never needs configuring. A project may define one **flow** whose stages layer on top; a stage names an agent, a skill, a mode, and an approval policy. A stage's approval policy is unioned with its mode's rather than replacing it, so a stage can raise what needs a person's say-so but never lower it.

**The model never reaches `done`.** A completed goal projects to `review`; only a person accepts. `PROJECT_TASK_ACTOR_TRANSITIONS` encodes this, and `update_task` withholds `done` from the model at the tool boundary as well as the service boundary.

**Runner identity is the person who starts the run**, never the assignee and never the workspace. Connector authority is user-owned (ADR 0012), so a task needing an unconnected provider blocks with a message naming the person who must connect it rather than borrowing another member's credentials. The queue handler re-resolves that user, their current workspace membership, and the project before it runs anything, because a queue entry is not proof of authorisation.

A run is an ordinary project conversation turn through `handleCreateChatCompletions` with `metadata.project_id`. There is no second way to run a turn (ADR 0022): the goal gate, tool execution, approvals, usage limits, and cancellation all apply unchanged. The board only sets the work up and projects the result back onto the card.

Make agents a project capability kind. A flow stage naming an agent reuses a persona that already has a table, an editor, and a marketplace, rather than inventing a parallel role concept. An attached agent keeps its persona but not its tool authority: `enabled_tools` are **intersected** with the project's effective tools, never unioned, so attaching a personal agent cannot widen what a workspace reaches. Only an agent's owner may attach it.

Aggregate attention. `/workspaces/attention` returns blocked, in-review, and self-assigned tasks across every workspace the caller belongs to, resolved from their memberships rather than any client-supplied id.

## Trade-offs

Unattended agent loops are a spend multiplier, and a board makes it easy to start many. A per-project concurrency cap and a per-task token budget ship with the first runnable version rather than later; usage exhaustion moves a card to `blocked` instead of burning quietly. This is the risk to watch, not a theoretical one.

A board invites project management. There are deliberately no due dates, estimates, or reports: this is about what the assistant is doing, and a card with no runner is only captured intent. If the product grows swimlanes it will own them forever.

One flow per project, stored as JSON on `project` and captured by project templates. Multiple flows would need a table; if that arrives, this column becomes a migration.

No Durable Object. ADR 0024 kept them out of chat deliberately, so the board polls with React Query — fast while something runs, once a minute otherwise. Live updates are the first thing to revisit, and `ConversationCoordinator` is where that would live.

`runPanel` and `TeamDelegation` still bypass the turn engine. That is real ADR 0022 debt, but coupling its repair to the board would double the risk of both. It stands, named, as separate work.

The sandbox and recipe runners are specified in `projectTaskRunnerKindSchema` as a single `conversation` variant for now. The goal owner union already accepts a sandbox run id, so the second runner is a small addition rather than a redesign — but it is not built, and neither is a personal-scope board under Chat.
