# @ngriffin_uk/polychat-library-tasks

## 0.2.3

### Patch Changes

- Updated dependencies [48eb3dc]
  - @ngriffin_uk/polychat-utility-server@0.5.0

## 0.2.2

### Patch Changes

- Updated dependencies [e0ca7c6]
- Updated dependencies [187afde]
  - @ngriffin_uk/polychat-utility-server@0.4.0

## 0.2.1

### Patch Changes

- Updated dependencies [80fee8e]
  - @ngriffin_uk/polychat-utility-server@0.3.0

## 0.2.0

### Minor Changes

- ece96c4: Add the AI function, agent, tool, workflow and task primitives. `ai-functions` exposes task-shaped calls (`generateText`, `generateObject`, `classify`, `extract`, media and retrieval) over a provider runtime. `ai-agents` builds `Agent` on the decision loop and tool catalogues, and replaces `agent-core` in every host. `library-tools` replaces `library-tool-runtime` and the tool registry schema with definitions, catalogues, validation and execution. `library-tasks` adds outcome settlement, execution leases, handler registries, polling and cron schedules and status machines, and `ai-workflows` wraps them in `on`/`poll`/`every` so the API declares queued tasks, self-rescheduling pollers (now with an attempt cap) and cron jobs in one registry.

### Patch Changes

- Updated dependencies [ece96c4]
- Updated dependencies [4968623]
- Updated dependencies [d25fd94]
- Updated dependencies [5ead2cc]
- Updated dependencies [b105d00]
- Updated dependencies [b105d00]
- Updated dependencies [57f8a16]
  - @ngriffin_uk/polychat-utility-server@0.2.0
