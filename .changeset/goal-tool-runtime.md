---
"@ngriffin_uk/polychat-library-tool-runtime": minor
"@ngriffin_uk/polychat-library-agent-core": minor
---

Extract shared tool runtime. `defineTool` gives every agent runtime one provider-facing tool shape, and the permission and mode-budget gating moves out of `apps/api` behind a narrowed `ToolAccessSubject`. `library-agent-core` keeps the control tool names and drops the definitions, staying a zero-dependency leaf.
