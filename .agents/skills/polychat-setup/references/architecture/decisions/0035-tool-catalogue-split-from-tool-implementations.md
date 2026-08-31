# ADR 0035: Tool catalogue split from tool implementations

## Status

Accepted.

## Context

`apps/api/src/lib/providers/library.ts` statically imports every registration module, and each registration imports the provider classes it constructs. That is correct for a registry, but it means nothing reachable from a provider implementation may import the registry without forming an ES module initialisation cycle.

Two inversions did exactly that. `apps/api/src/utils/parameters.ts` and `apps/api/src/lib/providers/lib/fetch.ts` imported `~/services/functions` — the tool-execution barrel, which loads all 44 tool implementations, 29 of which resolve a provider from the registry — solely to list tool schemas. Separately, `UserSettingsRepository` reached up into `userConfigurableProviders`, which lists chat providers from the registry, so the persistence layer depended on the thing that depends on it.

The result was a cycle through `BaseProvider`. Whether it threw depended on which file entered the graph first: importing a leaf chat provider first re-entered `base.ts` before it finished initialising and failed with `Class extends value undefined is not a constructor or null`, while `anthropic.ts` and `bedrock.ts` happened to work because they import `~/utils/parameters` before `./base` and so loaded the registry first. Provider unit tests were impossible to write without that accident of import order.

Deferring the edges with dynamic `import()` would have hidden the cycle rather than removed it, and `getToolsForProvider` is synchronous so it could not await one anyway.

## Decision

Split every function tool into a descriptor and an implementation. `apps/api/src/services/functions/definitions/**` holds the descriptor — name, description, input schema, type, cost, and permissions — as data with no behaviour. The tool module keeps `execute` and spreads its descriptor, so the executable definition and its registration are unchanged.

The provider layer reads the catalogue as data through `listFunctionToolDefinitions`, never through `~/services/functions`. `services/functions/index.ts` remains the only executable registry and reuses the same permission resolution and connector scoping from `definitions/index.ts`, so the catalogue and the registry cannot disagree.

`UserSettingsRepository` returns persisted provider settings only. Callers that need catalogue metadata pass it in: `services/user/userOperations.ts` joins provider descriptions for the settings surface, and provisioning takes the configurable provider ids as an argument.

`formatToolCalls` moves from `lib/chat/tools/execution.ts` to `lib/chat/tools/provider-tool-definitions.ts`, because shaping tool declarations for a provider is not tool execution and the provider layer needs it.

The rule this establishes: nothing reachable from a provider implementation may import `apps/api/src/lib/providers/library.ts`.

## Consequences

- A tool's schema and its handler live in two files. Adding a tool means adding a descriptor under `definitions/` and registering the implementation as before.
- The provider layer no longer loads tool implementations, so importing a chat provider no longer boots the registry, the tool layer, and the repositories.
- Provider behaviour can be unit tested directly. `moduleGraph.test.ts` imports a leaf provider as its first import and calls `defaultMapParameters`; it fails with the original error if any of these edges is reintroduced.
- `getUserProviderSettings` on the repository no longer carries `type`, `name`, `description`, or `configurationFields`. Consumers that only needed enablement are unaffected; the settings route gets the same shape through `userOperations`.
- Provisioning provider settings now takes the configurable provider ids as an argument, so the caller decides which catalogue applies rather than the repository reaching for one.
