# ADR 0020: Move prompt-shaped tooling into skills

## Status

Accepted

## Context

ADR 0018 introduced skills but shipped only `artifacts` and `recipes`. Alongside them the product still carried an older generation of features that were prompt behaviour wearing other clothes.

Three shapes recurred. Some were **function tools that called a weaker auxiliary model and scraped XML tags out of its reply**: `prompt_coach` (with a fabricated confidence score derived from which tags appeared), `add_reasoning_step` (which asked an auxiliary model to grade and rewrite the primary model's own reasoning), and `tutor`. Each cost a tool schema in every request and a round trip to a worse model to produce something the primary model does better in context.

Some were **tools that encoded how to approach a task rather than a capability**: `compose_functions`, `if_then_else`, `parallel_execute`, `retry_with_backoff`, and `fallback`. Five tool schemas describing planning, branching, and retry — all instruction, no capability.

One was a **prompt mode that replaced the system prompt outright**. Council returned early from `getSystemPrompt`, so a council conversation received no memory policy, no skills roster, no tool guidance, and no model metadata. Its multi-turn debate ran as a client-side loop in `useChatManager`, driven by a `<council_next>` routing tag the model was asked to emit and the server parsed back out of the response text. The roster of members was duplicated between a zod module and a second frontend-only copy.

Adding further behaviour under any of these shapes would keep multiplying fixed token cost, auxiliary-model round trips, and bespoke pipeline plumbing.

## Decision

Treat "how to do this kind of work" as skill content, and reserve tools for capability — something the model cannot do by reasoning alone.

Replace the auxiliary-model tools with skills: `prompt-craft`, `tutoring`, and `structured-reasoning`. Replace the orchestration tools with one `task-decomposition` skill covering planning, dependency ordering, branching, and failure classification. Delete the tools, their services, their routes, and their response renderers; no deprecation window and no compatibility shim.

Split `analyse_hacker_news` along the same line. Retrieval is capability, so `get_hacker_news_stories` keeps it and returns data only; the interpretation moves to a `hacker-news` skill. Add an `article-analysis` skill so chat can analyse a shared article, which it previously could not — the Articles app keeps its own prompts, because those back its routes and experience rather than chat.

Split council in two. The personas and the process become a `council` skill. The multi-turn debate becomes `run_council`, a server-side tool built on a generic `runPanel` primitive in `lib/chat/panel.ts`. The client loop, the routing tag, its parser, the prompt mode, and the duplicated roster are all removed.

To let a mode-like feature run under a skill without a `load_skill` round trip, introduce **pinned skills**. `chatRequestOptions.skills.pinned` names skills whose full bodies render into a `<pinned_skills>` prompt section up front. Pinning is presentation, not authorisation: a skill the scope has not made ready is never pinned, however the request asks. The Home Council mode becomes exactly this — pin the `council` skill — rather than a parallel prompt path.

Let a skill widen the tool set it needs. `polychat-tools` stays a hard requirement that marks a skill unavailable when the tool is off; new `polychat-suggests-tools` names tools a ready skill grants for the turn, merged into enabled tools at preparation alongside the existing memory-tool merge. Without this a skill that needs `web_search` silently disappears rather than working.

Generate `apps/api/src/data-model/skills/index.ts` from the directory tree with `pnpm --filter @assistant/api skills:generate`, and assert in the catalogue suite that the committed file matches, that every declared tool exists in the registry, and that every description states a trigger.

## Trade-offs

Behaviour that was deterministic code is now model judgement. A skill can be ignored where a tool call could not be, and the failure is silent. The catalogue suite guards structure — triggers, tool names, index drift — but not whether the model follows the instructions; that needs evaluation the repository does not yet have.

Removing `POST /apps/prompt-coach`, `POST /apps/retrieval/tutor`, and the seven deleted tool names is a breaking API change. Nothing in `apps/app` consumed the prompt-coach route, and the tutor route's UI is gone with it, but an external caller would break without warning.

Council loses its member picker and its live per-member streaming. Members are now chosen by the model from the tool schema, and the debate arrives as one tool result rather than as separate messages appearing in turn. The chamber runs on the auxiliary model rather than the conversation's model, which is cheaper and faster but less capable. In exchange council conversations regain memory, skills, tool guidance, and model metadata, which the prompt-mode bypass had silently denied them.

`runPanel` deliberately fixes the roster and ordering at call time. A member cannot elect the next speaker, so a panel cannot extend itself past the caller's budget — the failure mode the old routing tag allowed.

Pinned skills spend tokens up front, which is what ADR 0018 avoids by default. It is bounded to four skills and only applies when a mode or the user asks for it; the roster remains the default disclosure.

`polychat-suggests-tools` lets skill metadata widen the enabled tool set, which ADR 0018 explicitly refused for `allowed-tools`. The distinction is that suggestion applies only to skills the scope has already made ready, and it grants registered function tools for the turn; it does not bypass permission checks, approval policy, or project capability boundaries.
