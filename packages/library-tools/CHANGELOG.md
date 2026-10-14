# @ngriffin_uk/polychat-library-tools

## 0.3.1

### Patch Changes

- Updated dependencies [82c133e]
- Updated dependencies [005b9f3]
- Updated dependencies [393652d]
- Updated dependencies [e820856]
- Updated dependencies [7bec25b]
- Updated dependencies [65fbf81]
- Updated dependencies [65fbf81]
- Updated dependencies [b97c227]
- Updated dependencies [c965c69]
- Updated dependencies [06e4619]
- Updated dependencies [e41549c]
  - @ngriffin_uk/polychat-utility-core@0.4.0
  - @ngriffin_uk/polychat-schemas@1.4.0
  - @ngriffin_uk/polychat-library-policy@0.3.0
  - @ngriffin_uk/polychat-utility-server@0.2.1

## 0.3.0

### Minor Changes

- ece96c4: Add the AI function, agent, tool, workflow and task primitives. `ai-functions` exposes task-shaped calls (`generateText`, `generateObject`, `classify`, `extract`, media and retrieval) over a provider runtime. `ai-agents` builds `Agent` on the decision loop and tool catalogues, and replaces `agent-core` in every host. `library-tools` replaces `library-tool-runtime` and the tool registry schema with definitions, catalogues, validation and execution. `library-tasks` adds outcome settlement, execution leases, handler registries, polling and cron schedules and status machines, and `ai-workflows` wraps them in `on`/`poll`/`every` so the API declares queued tasks, self-rescheduling pollers (now with an attempt cap) and cron jobs in one registry.
- 67b52ed: Let people approve a Poly write once and for all, for one destination. When Poly at the assistant level waits on a write with a known destination, the approval card offers "Always allow here". The server derives the tool and destination from the stored pending call and keeps the approval on the Poly context for thirty days, where a Cedar condition lets matching writes run unattended. Sends, spending, deletes, credentials and exports still ask every time. Approvals are listed in Poly's autonomy menu and can be revoked there.
- 07290f2: Add a teammate autonomy dial. A teammate context can be an observer, an assistant or a partner, enforced by Cedar over each call's effect class: observers only read and draft, assistants ask before writes, partners write within their grants, and sends, spending, deletes, credentials and exports always ask. Poly starts as an assistant and its overlay can change the level. Run triggers now reach tool availability and execution, so Poly's navigation gate holds there too.
- cb9ddcc: Declare what each tool changes. `TOOL_EFFECT_CLASSES` names eight effect classes, `ToolDefinition.effects` declares a tool's class and destination, and `resolveToolEffectClass` treats an undeclared tool as a write. The API's built-in catalogue now refuses a tool without effects, and `call_api` and `use_recipe_connector` classify each call from its input.

### Patch Changes

- Updated dependencies [6db7a00]
- Updated dependencies [ece96c4]
- Updated dependencies [33133cc]
- Updated dependencies [ece96c4]
- Updated dependencies [4968623]
- Updated dependencies [b4c0c65]
- Updated dependencies [d3f1df3]
- Updated dependencies [297b848]
- Updated dependencies [3c23660]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [d25fd94]
- Updated dependencies [5ead2cc]
- Updated dependencies [dd4389b]
- Updated dependencies [462cbe7]
- Updated dependencies [b105d00]
- Updated dependencies [c126d04]
- Updated dependencies [b105d00]
- Updated dependencies [b105d00]
- Updated dependencies [90f7110]
- Updated dependencies [b105d00]
- Updated dependencies [251ac59]
- Updated dependencies [41bb6a8]
- Updated dependencies [67b52ed]
- Updated dependencies [67b52ed]
- Updated dependencies [ee31a6d]
- Updated dependencies [ee31a6d]
- Updated dependencies [67b52ed]
- Updated dependencies [ee31a6d]
- Updated dependencies [169e2f5]
- Updated dependencies [6966643]
- Updated dependencies [1e5cafb]
- Updated dependencies [462cbe7]
- Updated dependencies [e4ba666]
- Updated dependencies [1df361b]
- Updated dependencies [6e76041]
- Updated dependencies [b105d00]
- Updated dependencies [d3f1df3]
- Updated dependencies [57f8a16]
- Updated dependencies [07290f2]
- Updated dependencies [cb9ddcc]
  - @ngriffin_uk/polychat-schemas@1.2.0
  - @ngriffin_uk/polychat-utility-server@0.2.0
  - @ngriffin_uk/polychat-library-registry@0.3.0
  - @ngriffin_uk/polychat-utility-core@0.3.0
  - @ngriffin_uk/polychat-library-policy@0.2.0

## 0.2.0

### Minor Changes

- d841b16: Extract shared tool runtime. `defineTool` gives every agent runtime one provider-facing tool shape, and the permission and mode-budget gating moves out of `apps/api` behind a narrowed `ToolAccessSubject`. `library-agent-core` keeps the control tool names and drops the definitions, staying a zero-dependency leaf.
- f440eb7: Shape every provider-facing tool schema through the shared tool runtime. `defineTool` accepts a complete generated schema, `toProviderToolDefinitions` owns the bedrock and anthropic envelopes, and `flattenObjectRootSchema` moves out of the API. The loop control tool names are declared once, in the agent core.
- 2c14529: Let a caller widen a turn's approval requirements beyond its mode's. Project task flow stages use this to make `requiresApprovalFor` real: a stage can demand a person's say-so for permissions the mode would have allowed unattended, and can never lower the mode's own bar.

### Patch Changes

- Updated dependencies [40048e2]
- Updated dependencies [588f262]
- Updated dependencies [ac5b12e]
- Updated dependencies [42c36ea]
- Updated dependencies [e2ffadb]
- Updated dependencies [34728e1]
- Updated dependencies [d841b16]
- Updated dependencies [d841b16]
- Updated dependencies [293b1ca]
- Updated dependencies [f440eb7]
- Updated dependencies [6334297]
- Updated dependencies [fc4ed91]
- Updated dependencies [0a2d695]
- Updated dependencies [1836aad]
- Updated dependencies [19573b8]
  - @ngriffin_uk/polychat-schemas@1.0.0
  - @ngriffin_uk/polychat-library-agent-core@0.2.0
  - @ngriffin_uk/polychat-library-registry@0.2.0
