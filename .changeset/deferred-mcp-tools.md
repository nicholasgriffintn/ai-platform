---
"@ngriffin_uk/polychat-schemas": minor
---

Add `load_tools`, the contract for loading a tool definition mid-turn instead of sending every
schema up front.

An agent wired to a large MCP server used to spend its whole context budget on tool schemas before
the model read a word of the conversation: every tool from every configured server was inlined on
every step, unbounded. Agents with more than twelve MCP tools now receive `load_tools` instead,
whose description indexes the catalogue by server, and the tools it returns become callable from the
next turn. Smaller catalogues are still sent up front, where the schemas cost less than the extra
model turn a deferred load would.

`schemas` gains `LOAD_TOOLS_TOOL_NAME`, `loadToolsInputSchema`, and the load limits.
