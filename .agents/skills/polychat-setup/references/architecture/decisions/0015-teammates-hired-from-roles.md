# ADR 0015: Hire teammates from roles and call them teammates everywhere

Status: Implemented.

## Problem

Creating a saved persona meant filling in an empty editor — a name, a system prompt, a model, a tool list and a mode — before knowing what any of them should be. People who would benefit most were the least able to write the brief, so the feature stayed unused.

The product also called the saved persona a teammate while the code, API and database called it an agent, so every file translated between the two. "Agent" already names three unrelated things here: the turn engine's loop, the execution modes it runs in, and the run traces it records.

## Decision

A teammate is a saved persona hired from a built-in role, from a job description, or from both. Roles live in `packages/schemas` so every client reads the same catalogue: each carries a title, category, kind, summary, brief and its suggested tools and mode. Hiring resolves the role into an ordinary teammate record, so nothing downstream needs to know a role existed. A job description is appended to the role's brief rather than replacing it, and a teammate hired from a description alone must be named.

Every teammate has a `kind` of `colleague` or `bot`. A colleague is the existing behaviour; a bot answers and reports, and cannot file tasks or write to memory. The kind is stored, editable afterwards, and enforced server-side in two places: hiring and saving filter the teammate's own tool list, and preparing a run sends `denied_tools`, which the permission checker refuses whatever the mode allows and whatever the caller asks for. "Reads run on their own. Anything that writes to another system waits for your approval." is stated once in the contracts and shown wherever a teammate is hired or edited.

Layer a teammate's name, instructions and examples into the standard generated prompt as a persona. Preserve `system_prompt` as a full override for API callers; do not use it for ordinary saved-teammate identity. Give teammates a personal or workspace owning scope and keep `user_id` as author attribution. Workspace members may read and use workspace teammates, while owners and administrators manage them; publishing a personal teammate copies it with provenance. Treat saved models, tools, skills, mode and MCP configuration as requests checked in the executing scope: a saved mode changes instructions and budget, not permission authority, and project flows intersect skills and tools with project grants.

The saved persona is a teammate in every layer — storage tables and columns, the project capability kind, the API and web routes, and the contracts, services, hooks and components. There is no alias and no redirect from the old editor paths, because a half-migrated surface is the thing this record exists to remove. Three things keep the name agent, because they are not the persona: the turn engine and `library-agent-core`, `AgentMode` and the `agent` chat mode, and agent traces. `Agent Skills` is an external document format name.

## Consequences

The role catalogue is curated code, not data, so adding a role is a release. That keeps briefs reviewable and versioned at the cost of not being operator-editable. Bot restrictions are a tool-level refusal, so a bot given a custom MCP tool that writes elsewhere is bounded only by the ordinary approval rules. Published copies drift from their personal source by design, and durable multi-agent sequencing belongs to [project flows](0018-project-tasks-run-through-governed-flows.md).

Renaming four tables and five columns was a data migration shipped as an authored `ALTER TABLE ... RENAME` paired with a schema-generated snapshot, because `drizzle-kit generate` resolves renames through an interactive prompt that CI cannot answer. Every other schema change still goes through `db:generate`; a future rename needs the same one-off treatment from a terminal. Anything that stored the literal `agent` outside those tables, such as an exported project template, keeps the old value and will not match, and old persona links stopped working at the deploy.
