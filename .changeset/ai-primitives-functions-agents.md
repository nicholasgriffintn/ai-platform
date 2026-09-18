---
"@ngriffin_uk/polychat-ai-functions": minor
"@ngriffin_uk/polychat-ai-agents": minor
"@ngriffin_uk/polychat-library-tools": minor
"@ngriffin_uk/polychat-ai-workflows": minor
"@ngriffin_uk/polychat-library-tasks": minor
"@ngriffin_uk/polychat-library-agent-loop": minor
"@ngriffin_uk/polychat-schemas": minor
"@assistant/api": patch
---

Add the AI function, agent, tool, workflow and task primitives. `ai-functions` exposes task-shaped calls (`generateText`, `generateObject`, `classify`, `extract`, media and retrieval) over a provider runtime. `ai-agents` builds `Agent` on the decision loop and tool catalogues, and replaces `agent-core` in every host. `library-tools` replaces `library-tool-runtime` and the tool registry schema with definitions, catalogues, validation and execution. `library-tasks` adds outcome settlement, execution leases, handler registries, polling and cron schedules and status machines, and `ai-workflows` wraps them in `on`/`poll`/`every` so the API declares queued tasks, self-rescheduling pollers (now with an attempt cap) and cron jobs in one registry.
