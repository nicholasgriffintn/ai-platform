# ADR 0018: Carry specialised instructions as loadable skills

## Status

Accepted

## Context

Instructions for specific kinds of work were embedded directly in the system prompt. Artifact guidance was the largest example: type rules, an example artifact, numbered instruction steps, and a principle, assembled across `getResponseStyle`, the principles section, and the example-output section, then trimmed by context-window heuristics into compact variants.

Every request paid for that guidance whether or not the turn produced an artifact, and the compact variants dropped exactly the detail that prevents a broken deliverable. Because the text lived far from the artifact runtime, it also drifted: it advertised Tailwind, lucide-react, recharts and shadcn/ui inside a React sandbox that loads only React and ReactDOM, offered `/api/placeholder/...` image URLs that the sandbox content security policy blocks, and presented Mermaid as a rendered type when no Mermaid renderer exists.

`supportsArtifacts` compounded this. It was a per-model flag maintained by hand across every provider catalogue, and it decided whether artifact instructions appeared at all. Nothing about artifacts is model-specific: the constraint is that the assistant can call a tool.

Adding further specialised guidance — research, spreadsheets, diagrams, coding — under the same scheme would multiply both the fixed token cost and the drift.

## Decision

Introduce skills: named instruction bundles that the assistant loads on demand instead of carrying in every prompt.

Disclose them in three tiers. The system prompt carries only `<available_skills>`, with each ready skill's name and triggering description. The model calls the read-only `load_skill` function with a name to receive the full body and a list of relative resources. The same function accepts an exact resource path and returns that file. Nothing beyond the name and description is loaded until the model decides the work matches.

Define built-in skills as [Agent Skills](https://agentskills.io/specification) directories under `apps/api/src/data-model/skills`: each skill has a standards-compliant `SKILL.md` and may carry relative resources under `references/`, `scripts/`, or `assets/`. Standard frontmatter owns the portable name, description, compatibility, licence, metadata, and allowed-tool fields. Namespaced `polychat-*` metadata projects optional product presentation, curation, and runtime requirements without changing the portable document format.

Treat `allowed-tools` as portable skill metadata, not execution authority. A skill never enables or approves a tool, widens a project capability scope, or bypasses the existing permission and approval checks.

Import those Markdown documents directly as Worker text modules and register them in `apps/api/src/data-model/skills/index.ts`. The catalogue owns validation, product projection, and lookup; availability owns model, tool, and scope readiness. Do not introduce a storage adapter until authenticated user-provided skills create a real second implementation. Prompt rendering stays in `lib/prompts/sections/skills.ts` with the other prompt sections.

Make skills a capability kind. They appear in the capability library in both Chat and Work and follow the existing scope split from ADR 0016: personal enablement is curation, so every skill is ready until the user turns it off, with the opt-out stored in `capability_configuration` per ADR 0017; project enablement is authorisation, so a project skill is ready only once the project enables it, recorded on `project_capability`. Skills marked always-on are part of the product contract, are ready in both scopes, and cannot be enabled or disabled.

Remove `supportsArtifacts` entirely — from the model schema, every provider catalogue, and the prompt capability set. Artifacts are a skill requiring `supportsToolCalls`, which is the real constraint: without tool calls there is no `load_skill`, so there are no skills at all.

Ship two skills. `artifacts` replaces the removed prompt guidance and states the sandbox contract accurately, with `references/types.md` and `references/design.md` resources. `recipes` is always-on and holds the discovery, invocation, setup, and connector-selection guidance that ADR 0015 gives the model, so recipes stay configured for everyone.

## Trade-offs

A skill costs a tool call and a round trip before the work starts. That is the price of the roster staying at roughly fifteen tokens per skill instead of the hundreds a full body costs, and it only falls on turns that need the guidance. Skills whose instructions apply to nearly every turn do not belong here; the prompt sections remain the right home for those.

Wrangler needs one `Text` module rule for Markdown, and the Vitest configuration mirrors that import behaviour. Each built-in skill and resource is registered explicitly, so adding one changes the document and the nearby data-model index without generated output or a synchronisation command. Dynamic user-provided skills will need authenticated persistence and scope handling; add that seam when its requirements and second implementation exist rather than predicting it here.

Roster descriptions become load-bearing. A skill is only used when its description matches how the model reads the request, so a poor description silently disables it. Descriptions must state triggering conditions rather than summarise contents.

The model can also ignore a roster entry and answer without loading. Guidance that must not be skipped — safety standards, instruction precedence — stays in the prompt.

Availability is resolved twice: once when building the prompt and once when `load_skill` runs. The two can disagree if scope changes mid-conversation. The tool check is authoritative and fails closed, so the worst case is a refused load rather than a leaked skill.

Removing `supportsArtifacts` is a breaking change to the model configuration schema. Nothing consumed it beyond prompt assembly, and every remaining artifact decision now derives from tool support.
