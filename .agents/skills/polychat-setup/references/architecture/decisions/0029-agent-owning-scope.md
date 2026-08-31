# ADR 0029: Give a saved agent an owning scope

## Status

Accepted

## Context

A saved agent belonged to one `user_id`, and every read and write compared the caller against it. A project flow stage can name an agent, so a workspace could run an agent that only one person could see, configure, or repair. That person could also delete the row the flow depended on.

The same problem was already solved for runtime settings: `capability_configuration` names its owner with a `scope_type` and `scope_id` pair rather than a single user column (ADR 0017).

## Decision

Give `agents` an owning scope: `owner_scope_type` of `user` or `workspace`, plus `owner_scope_id`. `user_id` stays as the author for attribution and existing foreign keys, and is no longer the authorisation rule.

`apps/api/src/services/agents/access.ts` is the single place that resolves agent authority. Reading or using a personal agent is the author's alone; a workspace agent is readable by any member of the owning workspace. Creating, updating, or deleting a personal agent is the author's alone; the same operations on a workspace agent require `owner` or `admin`, because a plain member must not silently repoint an agent that drives project flows.

Publishing a personal agent to a workspace copies it. The workspace copy carries `derived_from_agent_id` back to its source, and the source stays personal. A project therefore never depends on a row one person can delete.

An agent may be attached to a project when the person can read it, not only when they own it. Resolving a flow stage agent additionally requires the agent to be available to the project's workspace, so an agent that has moved out of scope fails closed rather than running.

## Trade-offs

A copy is not a link. Editing the personal source does not update the workspace copy, and the two drift. That is the point: the workspace owns what it runs, and provenance is recorded rather than enforced.

The scope key is polymorphic, so no foreign key covers both owner types. Workspace deletion must clear workspace-owned agents as part of its own lifecycle.

Authorising a workspace agent goes through `requireWorkspaceAccess`, so it inherits the Pro-plan gate on Work. A person who loses that gate loses access to workspace agents along with the rest of Work.
