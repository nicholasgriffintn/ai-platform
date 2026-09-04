# ADR 0036: Compose scoped agents from platform capabilities

Status: Accepted.

A saved persona must retain platform behaviour and must not grant capabilities its runner lacks.

## Decision

Layer a saved agent's name, instructions and examples into the standard generated prompt as a persona. Preserve `system_prompt` as a full override for API callers; do not use it for ordinary saved-agent identity.

Give agents a personal or workspace owning scope; keep `user_id` as author attribution. Centralise access in `services/agents/access.ts`. Workspace members may read and use workspace agents, while owners and administrators manage them. Publishing a personal agent copies it with provenance rather than leaving the workspace dependent on its source.

Treat saved models, tools, skills, mode and MCP configuration as requests checked in the executing scope. Merge `load_skill` when saved skills require it. A saved mode changes instructions and budget, not permission authority. Project flows intersect skills and tools with project grants and resolve stage mode before task-runner and agent defaults.

Manage agents from the capability library and shared editor routes. Keep marketplace publishing personal; installation creates a copy. Do not add connector or source fields until the request and retrieval runtimes actually consume a narrowed set.

## Trade-off

Published copies can drift from their personal source by design. Persona and skill instructions rely on model behaviour, while capability access remains server-enforced. Durable multi-agent sequencing belongs to [project flows](0026-project-task-boards.md).
