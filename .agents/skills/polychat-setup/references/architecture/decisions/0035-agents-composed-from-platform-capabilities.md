# ADR 0035: Compose a saved agent from the platform's own capabilities

## Status

Accepted

## Context

[0023](0023-agents-are-chat-completions-with-a-persona.md) settled that a saved agent is a persona plus a tool scope. That is all it was. Every other capability the platform has, an agent reached for a private version of, or could not reach at all.

A project flow stage carries `skillIds`; an agent had no way to name a skill. A flow stage picks freely from `agentModeSchema`, while `prepareAgentCompletionRequest` pinned `mode: "agent"`, so a plan agent or an explore agent could not be saved.

## Decision

The agent contract carries two more fields, stored as JSON text columns beside `servers` and `enabled_tools`: `skill_ids` and `mode`. They reuse the identifiers the rest of the platform already uses — `skillIdSchema` and `agentModeSchema` — rather than free text.

**A saved capability is a request, never a grant.** Each field passes through the same availability, permission, and approval checks as any other turn:

- **Skills** reach the turn the way a flow stage's do: named in the agent's persona instructions, resolved by `load_skill` against the request's own scoped catalogue. An agent naming a skill its runner cannot see gets an error from `load_skill`, not the skill. Because an explicit `enabled_tools` list suppresses the managed discovery tools, an agent that names skills also has `load_skill` merged into its tool list — without it, saved skills would be inert.
- **Mode** sets `mode` only. `tool_policy_mode` stays pinned to `chat`, so an agent cannot widen its own tool permissions by saving `build`. A stored value that is not a known mode falls back to today's `agent`.

Inside a project, both fields narrow to what the project grants. `resolveTaskRuntime` unions a stage's skills with the agent's and intersects the result with the project's attached skills, and lets a stage's mode beat the agent's saved one.

Copies carry only what is safe to copy. Publishing to a workspace copies both fields, because the publisher already holds them. A marketplace install copies both too: neither names another account's data, and the installer's own scoped catalogue still decides at run time whether a named skill resolves.

## Trade-offs

Connectors and sources were the obvious next two fields, and we deliberately left them out. Nothing carries them into a turn: `options.connector` names one exact connector chosen in the composer, `options.recipe.allowedConnectorProviders` narrows within a recipe, and `connectedConnectorProviders` is derived by `RequestPreparer` from real connections, so setting it from an agent record would assert a connection rather than request one. Retrieval has no per-source filter at all — `search_documents` reaches `queryEmbeddings` with no way to name a subset. A field that is validated, stored, returned, and then ignored is a defect, not a placeholder: it tells an author their agent is scoped when it is not. Add them when a request seam carries them, and pay the migration then.

Skills arriving as persona prose rather than as a request field means the model can ignore them. That is the same trade a flow stage makes, and it keeps skill authority in one place — the scoped catalogue — instead of splitting it between a roster and an agent record.

Merging `load_skill` into an agent's explicit tool list adds a tool its author did not name. The tool is read-only and cannot return a skill outside the request's catalogue, so it grants nothing the roster did not already offer.
