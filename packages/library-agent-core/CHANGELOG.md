# @ngriffin_uk/polychat-library-agent-core

## 0.2.0

### Minor Changes

- d841b16: Extract shared tool runtime. `defineTool` gives every agent runtime one provider-facing tool shape, and the permission and mode-budget gating moves out of `apps/api` behind a narrowed `ToolAccessSubject`. `library-agent-core` keeps the control tool names and drops the definitions, staying a zero-dependency leaf.

### Patch Changes

- 34728e1: Establish the reusable React frontend package graph, host controls, shared contracts, runtime
  libraries, render modules, tooling presets, and publishable package interfaces.
- f440eb7: Shape every provider-facing tool schema through the shared tool runtime. `defineTool` accepts a complete generated schema, `toProviderToolDefinitions` owns the bedrock and anthropic envelopes, and `flattenObjectRootSchema` moves out of the API. The loop control tool names are declared once, in the agent core.
