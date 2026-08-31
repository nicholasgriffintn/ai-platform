# ADR 0036: Retire team agents in favour of project flows

## Status

Accepted

## Context

The platform carried two mechanisms for sequencing work across several agents, and the older one never earned its keep.

A saved agent carried `team_id`, `team_role` and `is_team_agent`. `team_id` was free text an author typed into a box, so a "team" existed only as a string two records happened to share, with no record of its own, no membership check beyond the owning user, and no way to list, rename or dissolve it. A team's display name was derived by stripping the word "orchestrator" out of a member's name. An agent whose `team_role` read `orchestrator` was handed three delegation tools — `delegate_to_team_member`, `delegate_to_team_member_by_role` and `get_team_members` — backed by `TeamDelegation`, which ran a nested `getAIResponse` with its own depth limit, cycle detection and in-memory rate limiter. That nested loop bypassed the turn engine, so a delegated run produced no conversation, no goal, no approval gate, no budget and no stored result. [0026](0026-project-task-boards.md) named this as debt when it shipped project task boards, and left it standing rather than coupling its repair to that work.

Project flows have since answered the same question properly. A flow stage names an agent, its skills, its mode, the permissions it must seek approval for, its token budget and its dependencies, and every stage writes a durable completion snapshot. It runs through the turn engine like any other conversation. Two mechanisms for one idea, and the newer one is better on every axis that matters.

## Decision

Delete team agents. There is no replacement seam and no compatibility shim.

- Drop `team_id`, `team_role` and `is_team_agent` from `agents`, along with the `agents_team_id_idx` index, in migration `0014_gigantic_vapor`. The remaining columns and rows are untouched.
- Remove the three fields from `createAgentSchema`, `updateAgentSchema` and `agentResponseSchema`, so the wire contract no longer accepts or returns them.
- Delete `TeamDelegation`, the three tool definitions, and their registrations in the function registry, the tool categories, and the capability-discovery internal list. `buildAgentCompletionTools` no longer branches on a role.
- Delete `GET /v1/agents/teams` and `GET /v1/agents/teams/:teamId`, the service functions behind them, and the three repository queries that served them — including `getAgentsByTeam`, already dead before this change.
- Remove `current_agent_id`, `delegation_stack` and `max_delegation_depth` from the chat request options. All three existed to carry a delegation frame; with the nested loop gone nothing writes them, and `complete_goal`'s guard against a delegated agent closing the delegating thread's goal is unreachable, so it goes too.
- Drop the `PROJECT_TASK_FLOW_OWNED_TOOLS` set and the `withoutFlowOwnedTools` filter in `services/project-tasks/flow.ts`. It existed to keep nested delegation out of a stage the flow already sequences; with no delegation tools to strip, an empty set and a no-op filter would be worse than nothing.
- Delete the web surface: the agent form's **Team** tab, `TeamCard`, the `AgentTeam` and `GroupedAgents` types, and the client-side grouping that derived a team name from an orchestrator's. `AgentsList` now takes a plain list of agents. With no team members to hide, `useAssistantActionCatalog` reads the server capability catalogue alone and no longer fetches `/agents` to filter it.

Multi-agent work in Work is a project flow. Multi-agent work in Chat is `run_council` and `second_opinion`, which return within the caller's turn and never claimed to be a durable run.

## Trade-offs

This removes a shipped feature. Anyone who built a team loses it, and there is no automatic migration of an existing team into a project flow: the shapes do not correspond. A team was an unordered bag of agents sharing a string, with routing decided by the orchestrator model at run time; a flow is an ordered set of stages with declared dependencies and approval points. Turning one into the other means deciding what the stages actually are, which is an authoring judgement no migration can make. Affected authors keep their agents — only the grouping and the delegation tools disappear — and must rebuild the sequencing as a project flow by hand.

Personal scope loses nested delegation entirely, because flows live under a project. That is a real narrowing, not an oversight. A personal orchestrator produced no record of what its members did, so the capability it offered was thinner than it looked, and rebuilding it properly belongs with the turn engine rather than beside it.

The `delegate` tool permission stays in `TOOL_PERMISSIONS` and in the mode policies, but no tool now declares it and the flow and task dialogs no longer offer it: an approval gate that can never fire is a control that misleads. Keeping the taxonomy entry costs nothing and leaves the seam ready if a future delegation mechanism arrives through the turn engine; removing it would churn the permission vocabulary for no gain today. A saved flow stage that already carries `delegate` still renders it as a ticked, labelled option so an author can see it and clear it, rather than having it persist invisibly on every save.
