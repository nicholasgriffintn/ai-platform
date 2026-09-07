# @ngriffin_uk/polychat-library-tool-runtime

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
