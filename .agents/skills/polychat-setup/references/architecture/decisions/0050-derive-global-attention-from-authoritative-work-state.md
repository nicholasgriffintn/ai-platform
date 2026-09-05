# ADR 0050: Derive global Attention from authoritative work state

Status: Accepted and implemented.

People with several workspaces need one operational view, but a copied attention table would become another workflow state machine and could retain work after membership or source state changed. Searching conversation prose would also mistake descriptions for actionable state.

## Decision

Define **Attention** as an API read model over current project-task interaction state and sandbox-run Activity records. It has no identity or persistence of its own. Map task blocks awaiting approval or input, review, other blocked states, queued or running work and seven days of completed work into the shared approval, input, review, failed, running and completed meanings. Map sandbox activity through its durable status and persisted run status; an explicitly waiting non-paused run represents approval, while a waiting state older than the maximum approval window becomes failed or stalled rather than remaining falsely actionable.

Expose the read model from `GET /workspaces/attention`. Validate state, workspace, project, owner, type, inclusive date, limit and offset filters at the route. Order by authoritative occurrence time descending and stable item identity descending, return an exact filtered total and derive filter facets only from currently eligible candidates. Keep the small task-only endpoint for existing project badges and overview summaries rather than making those consumers interpret run items.

Join `workspace_member` inside both task and run candidate queries and exclude archived projects. Do not trust project identifiers supplied by the client and do not cache membership-bearing results across users. Owner means the runner when known, then the assignee, then the task creator; a run owner remains its initiating user. The detail link returns to the existing task, project conversation or project Activity surface, where the existing authority and resolution controls apply.

Use the existing task, Activity and workspace indexes, plus a composite sandbox-activity operational index. Keep the recent-completion horizon fixed at seven days so historical success does not make the operational query unbounded. Query failures fail the whole response instead of presenting a partial list as complete; the repository request meter and standard database error logging cover query cost and failure without logging item content.

The web host owns URL serialisation and fetching. The router-free component receives validated items, facets, filters and navigation actions. Other clients can consume the same contract with different layouts.

## Consequence

Attention changes immediately with task, run and current membership state and introduces no scheduler, queue or execution authority. The read model intentionally does not copy conversation prose, connector credentials, command output or hidden reasoning. Offset pagination has deterministic ordering but, as with other live operational lists, concurrent state transitions can move an item between pages; clients should refresh rather than treat a page as a snapshot.
