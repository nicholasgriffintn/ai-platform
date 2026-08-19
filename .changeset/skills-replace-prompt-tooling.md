---
"@ngriffin_uk/polychat-component-conversation": major
"@ngriffin_uk/polychat-component-content": major
"@ngriffin_uk/polychat-library-chat": major
"@ngriffin_uk/polychat-schemas": major
---

Move prompt-shaped tooling into skills, and reserve function tools for real capability.

Seven built-in skills replace features that were previously prompt behaviour in tool or prompt-mode
form: `prompt-craft`, `tutoring`, `structured-reasoning`, `task-decomposition`, `council`,
`hacker-news`, and `article-analysis`.

Breaking changes:

- `councilChatOptionsSchema`, `COUNCIL_APP_ID`, and the `@ngriffin_uk/polychat-schemas/council-data`
  subpath are removed. `councilMembers` and `councilMemberIds` remain on the package root.
- `chatRequestOptions.council` is replaced by `chatRequestOptions.skills.pinned`, which names skills
  whose instructions load up front instead of on demand.
- `component-conversation` no longer exports `CouncilChatControls`, and messages no longer carry
  `data.council`; `library-chat` drops the matching message-data type.
- `component-content` no longer exports `TutorView`.
- `skillRequirement` gains `suggestedTools`, and `skillCategory` gains `Reasoning`.
- Authored skill documents accept an optional `resources` array.

Removed API surface: `POST /apps/prompt-coach`, `POST /apps/retrieval/tutor`, and the
`prompt_coach`, `tutor`, `add_reasoning_step`, `compose_functions`, `if_then_else`,
`parallel_execute`, `retry_with_backoff`, `fallback`, and `analyse_hacker_news` tools.

Added: `run_council`, backed by a reusable panel primitive that runs a fixed roster of perspectives
as separate completions, and `get_hacker_news_stories`, which returns front-page data without an
auxiliary-model pass.
