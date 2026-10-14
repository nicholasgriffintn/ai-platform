# @ngriffin_uk/polychat-library-agent-loop

## 0.3.1

### Patch Changes

- Updated dependencies [82c133e]
- Updated dependencies [393652d]
- Updated dependencies [7bec25b]
- Updated dependencies [c965c69]
- Updated dependencies [06e4619]
- Updated dependencies [e41549c]
  - @ngriffin_uk/polychat-utility-core@0.4.0
  - @ngriffin_uk/polychat-library-interactions@0.1.2
  - @ngriffin_uk/polychat-library-tools@0.3.1
  - @ngriffin_uk/polychat-utility-server@0.2.1

## 0.3.0

### Minor Changes

- ece96c4: Add the AI function, agent, tool, workflow and task primitives. `ai-functions` exposes task-shaped calls (`generateText`, `generateObject`, `classify`, `extract`, media and retrieval) over a provider runtime. `ai-agents` builds `Agent` on the decision loop and tool catalogues, and replaces `agent-core` in every host. `library-tools` replaces `library-tool-runtime` and the tool registry schema with definitions, catalogues, validation and execution. `library-tasks` adds outcome settlement, execution leases, handler registries, polling and cron schedules and status machines, and `ai-workflows` wraps them in `on`/`poll`/`every` so the API declares queued tasks, self-rescheduling pollers (now with an attempt cap) and cron jobs in one registry.

### Patch Changes

- Updated dependencies [ece96c4]
- Updated dependencies [ece96c4]
- Updated dependencies [4968623]
- Updated dependencies [297b848]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [d25fd94]
- Updated dependencies [5ead2cc]
- Updated dependencies [c126d04]
- Updated dependencies [b105d00]
- Updated dependencies [90f7110]
- Updated dependencies [67b52ed]
- Updated dependencies [1df361b]
- Updated dependencies [b105d00]
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
- Updated dependencies [cb9ddcc]
  - @ngriffin_uk/polychat-library-tools@0.3.0
  - @ngriffin_uk/polychat-utility-server@0.2.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
  - @ngriffin_uk/polychat-library-interactions@0.1.1

## 0.2.0

### Minor Changes

- d841b16: Extract shared tool runtime. `defineTool` gives every agent runtime one provider-facing tool shape, and the permission and mode-budget gating moves out of `apps/api` behind a narrowed `ToolAccessSubject`. `library-agent-core` keeps the control tool names and drops the definitions, staying a zero-dependency leaf.

### Patch Changes

- 34728e1: Establish the reusable React frontend package graph, host controls, shared contracts, runtime
  libraries, render modules, tooling presets, and publishable package interfaces.
- f440eb7: Shape every provider-facing tool schema through the shared tool runtime. `defineTool` accepts a complete generated schema, `toProviderToolDefinitions` owns the bedrock and anthropic envelopes, and `flattenObjectRootSchema` moves out of the API. The loop control tool names are declared once, in the agent core.
