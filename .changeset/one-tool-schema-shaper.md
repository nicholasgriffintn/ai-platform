---
"@ngriffin_uk/polychat-library-tool-runtime": minor
"@ngriffin_uk/polychat-library-agent-core": patch
---

Shape every provider-facing tool schema through the shared tool runtime. `defineTool` accepts a complete generated schema, `toProviderToolDefinitions` owns the bedrock and anthropic envelopes, and `flattenObjectRootSchema` moves out of the API. The loop control tool names are declared once, in the agent core.
