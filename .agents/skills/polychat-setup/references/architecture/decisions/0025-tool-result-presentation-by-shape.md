# ADR 0025: Tool result presentation by declared renderer and payload shape

## Status

Accepted

## Context

A tool result reached the conversation through two unrelated renderings. A `role: "tool"` message went to `ToolMessage` and the full `ResponseView`. The same result carried as a `tool_result` part on an assistant turn went to a local fallback that dropped presentation metadata and `onToolInteraction`, and whose result resolver whitelisted `get_weather` by name. Every fix applied to one path silently missed the other, which is how the parts path fell as far behind as it did.

Presentation was also inferred rather than declared. The API matched substrings against the tool name — `name.includes("search")`, `name.includes("video")` — in an order-dependent ladder. `search_memories` was typed as a web search, `create_video` resolved to a template that did not exist and rendered "No response is available.", and `capture_screenshot` was typed `template` while an earlier media probe made that branch unreachable. Separately, `responseType` was carrying view names — `council_turn`, `document_search`, `second_opinion` — that the six-value schema enum does not permit; they passed only because `message.data` is untyped on the wire.

The registry itself keyed on the tool name. That cannot work for the capabilities this platform is built around: MCP servers, recipes, and connectors mint tool names at runtime, so no registry written ahead of time can name them. Every MCP result rendered as a raw JSON tree.

## Decision

Render every tool result through one `ToolResultView`, whichever path it arrived on. It owns the shared chrome — the tool's icon, formatted label, status, and folded arguments — and delegates the body to `ResponseView`. `resolveToolResultPartDisplay` and `resolveToolMessageDisplay` in `library-chat` build its input from a part or a legacy message respectively, reading the presentation metadata the API already attached rather than matching on the tool name.

Tools declare presentation; the server does not infer it. `getToolPresentation` in `apps/api/src/utils/functions.ts` is an explicit table of renderer id, icon, and any declared response type. A tool with no entry is not a gap — it is the normal case, and falls through to shape resolution.

Separate the two identities that `responseType` was carrying. `responseType` keeps its six schema values. A new `renderer` field carries the client view id, and the conversation registry keys on that. A tool result may declare a renderer without constraining its response type.

Resolve anything undeclared from the payload. `resolveResponsePresentation` reads shape, most specific first: generated media, then url-bearing records as source cards, then consistently-keyed records as a table, then a lone prose field as markdown, then flat scalars as a definition list, and only then JSON. The JSON branch leads with the tool's own prose and folds the payload into a disclosure, so an unrecognised result reads as a result rather than as a debug dump.

Check status before shape. A result whose `status` is a failure renders as an error with its payload folded away, so a broken tool cannot pass for a working one by borrowing a successful tool's presentation.

Human-in-the-loop tools get real views. `ask_user` and `request_approval` previously shipped server-authored HTML containing an input and buttons with no event handlers attached; their Tailwind classes also sat outside the app's `@source` glob and were never compiled. Both are now React views wired through `onToolInteraction`.

Do not accept server-authored response markup or presentation configuration. No tool declared it, table columns are inferred from payload shape, and specialised presentation already belongs in registered React views. The unused metadata created an unvalidated route from tool results to an HTML sink, so the contract and renderer were removed rather than retained behind validation or a compatibility path.

## Trade-offs

Shape resolution guesses. A payload can satisfy a branch its author did not intend — a records array that happens to carry `url` fields renders as source cards rather than as a table. The ordering is deliberate and the thresholds are conservative (a table needs at least two rows, consistent scalar columns, and no more than eight of them), but a tool that cares about its presentation should declare a renderer rather than rely on inference.

The renderer table lives beside the tools rather than on each tool definition. Threading presentation through `ToolDefinition` and the registry would co-locate it better, at the cost of an import path from `utils/tool-responses` into the whole tool graph. Revisit if the table starts drifting from the tools it describes.

Conversations stored before this change carry response types inferred from the old ladder, including generated media typed as `template`. `ResponseView` keeps a media probe ahead of the type switch so that history still renders. That probe is compatibility, not design, and can be removed once stored messages no longer carry inferred types.
