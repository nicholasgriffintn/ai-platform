# @ngriffin_uk/polychat-ai-workflows

## 0.2.1

### Patch Changes

- Updated dependencies [80fee8e]
  - @ngriffin_uk/polychat-utility-server@0.3.0
  - @ngriffin_uk/polychat-ai-telemetry@0.2.2
  - @ngriffin_uk/polychat-library-tasks@0.2.1

## 0.2.0

### Minor Changes

- ece96c4: Add the AI function, agent, tool, workflow and task primitives. `ai-functions` exposes task-shaped calls (`generateText`, `generateObject`, `classify`, `extract`, media and retrieval) over a provider runtime. `ai-agents` builds `Agent` on the decision loop and tool catalogues, and replaces `agent-core` in every host. `library-tools` replaces `library-tool-runtime` and the tool registry schema with definitions, catalogues, validation and execution. `library-tasks` adds outcome settlement, execution leases, handler registries, polling and cron schedules and status machines, and `ai-workflows` wraps them in `on`/`poll`/`every` so the API declares queued tasks, self-rescheduling pollers (now with an attempt cap) and cron jobs in one registry.

### Patch Changes

- 6db7a00: Add the experimentation primitives. `library-flags` is an OpenFeature-shaped evaluation contract with a rules provider (deterministic bucketing from the targeting key, weighted splits, targeting, enable gates), a Cloudflare Flagship binding adapter and a layered provider that lets the dashboard override code. `ai-experiments` defines flags and experiments in code, assigns users with `feature_flag.evaluation` exposure events, runs work under an assignment, tracks outcomes with assignments attached, and runs offline variant sweeps with metrics. The API wires a per-request `Experiments` into the service context, tags AI generation telemetry with `experiment.<key>` properties, gates the flagged cron tasks through flags whose defaults come from the existing environment toggles, accepts an optional `FLAGS` Flagship binding, and serves `GET /flags/bootstrap`. Cron `enabledWhen` may now be asynchronous.
- Updated dependencies [ece96c4]
- Updated dependencies [ece96c4]
- Updated dependencies [ece96c4]
- Updated dependencies [4968623]
- Updated dependencies [b4c0c65]
- Updated dependencies [d25fd94]
- Updated dependencies [5ead2cc]
- Updated dependencies [b105d00]
- Updated dependencies [b105d00]
- Updated dependencies [57f8a16]
  - @ngriffin_uk/polychat-ai-telemetry@0.2.0
  - @ngriffin_uk/polychat-library-tasks@0.2.0
  - @ngriffin_uk/polychat-utility-server@0.2.0
