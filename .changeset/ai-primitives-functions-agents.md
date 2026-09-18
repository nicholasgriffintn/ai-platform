---
"@ngriffin_uk/polychat-ai-functions": minor
"@ngriffin_uk/polychat-ai-agents": minor
"@ngriffin_uk/polychat-library-tools": minor
"@ngriffin_uk/polychat-library-workflows": minor
"@ngriffin_uk/polychat-library-tasks": minor
"@ngriffin_uk/polychat-library-agent-loop": minor
"@ngriffin_uk/polychat-schemas": minor
"@assistant/api": patch
---

Add the AI function, agent, tool, workflow and task primitives. `ai-functions` exposes task-shaped calls (`generateText`, `generateObject`, `classify`, `extract`, media and retrieval) over a provider runtime. `ai-agents` builds `Agent` on the decision loop, tool catalogues and workflows, and replaces `agent-core` in every host. `library-tools` replaces `library-tool-runtime` and the tool registry schema with definitions, catalogues, validation and execution. `library-workflows` adds workflows, events, schedules and workers, and `library-tasks` adds outcome settlement, execution leases, handler registries and status machines used by the API task executors.
