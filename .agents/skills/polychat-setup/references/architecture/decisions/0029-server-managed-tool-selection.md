# ADR 0029: Server-managed tool selection

## Status

Accepted. Extends [ADR 0015](0015-model-driven-capability-discovery.md) and [ADR 0028](0028-response-scoped-capability-activation.md).

## Context

Every surface picked its own function tools. The web composer carried a tool picker, iOS carried a toggle list in chat settings, and both sent the result as `enabled_tools`. The API treated that list as authoritative, so the model saw whatever the person had switched on months earlier — often a broad default set that cost prompt budget and blunted tool selection, or a stale narrow one that made a capability look missing.

ADR 0028 made discovery able to switch on an eligible tool for the rest of a response, which removed the reason for a person to curate the list at all. Leaving the picker in place kept two competing answers to the same question, and the picker was the one that lost information: it could not see the turn.

Tool selection is not the same question as hosted model tools. Web search grounding, code execution, and the rest are provider features with cost and behaviour a person reasonably chooses per model, and they stay manual.

## Decision

Add `tool_selection_mode` to the chat completion request. `explicit` is the default and keeps `enabled_tools` exactly as sent, so API consumers continue to define their own tools. `managed` tells the server to top the request up with the baseline it owns.

Web and iOS always send `managed`. The server resolves the effective set as the request's own tools — hosted model toggles, an agent's configuration, a recipe launch — unioned with the managed baseline, which is capability discovery, skill loading, and web search for a signed-in person. Everything else arrives through discovery under ADR 0028. A project stays authoritative: its curated capabilities still bound the request, and only the discovery tools are exempt so a project conversation can find what the project curates.

A surface that genuinely configures tools stays explicit. Selecting an agent that names its own tools switches the web client to `explicit`; leaving that agent hands the choice back to the server.

Two gaps in ADR 0028's activation close with this. A ready recipe or connector now marks its runner tool for activation the way a directly discovered tool does, and a tool that declares `companionTools` activates them alongside it, so the model never holds half a workflow. Loading a skill activates the tools that skill declares, which replaces merging every ready skill's suggested tools into the request up front.

Remove the composer tool picker and the iOS tool toggles. The tool catalogue endpoint stays: agent configuration and project capability curation are still people choosing durable configuration, not a per-turn switch.

## Trade-offs

A person can no longer force a specific function tool into a turn from the composer. The recovery is one discovery step, which the model takes on its own; a hard boundary is still mode policy, approval policy, plan eligibility, or project curation.

Tools already selected in the old picker are dropped when the persisted store migrates, keeping only hosted model toggles. This is deliberate: a stale selection is exactly what the managed baseline replaces.

Discovery costs a step on turns that need an uncommon tool. That is the trade ADR 0028 already accepted, taken further: the baseline is now small enough that the step is the normal path rather than the exception.
