---
"@ngriffin_uk/polychat-component-conversation": minor
"@ngriffin_uk/polychat-library-chat": minor
"@ngriffin_uk/polychat-schemas": minor
---

Add `tool_loading`, so a conversation can hold tool definitions back and let the assistant load them
when it needs them.

Every enabled tool used to be serialised into every request, on every step. That is fine for a
handful of tools and wasteful for a full set, and unbounded for an agent wired to a large MCP
server, where every tool from every configured server was inlined with no ceiling.

`tool_loading` takes `auto` (the default), `eager`, or `deferred`. When tools are deferred, the
request carries only the control-plane tools plus a name-only index in the system prompt;
`discover_capabilities` — which already searched tools, recipes, and connectors — now also loads
what it finds, and the tool becomes callable on the next turn. Loads carry across turns of the same
conversation, so the assistant pays for a lookup once.

Deferral never widens what a conversation may run: only already-enabled tools enter the catalogue,
and plan and mode gating still apply to everything discovery returns.

`schemas` gains `toolLoadingModeSchema` and `chat_completions.tool_loading`; `library-chat`'s
`ChatSettings` gains `tool_loading`; `ChatSettingsPanel` gains a Tool loading control and a required
`onToolLoadingChange` prop.
