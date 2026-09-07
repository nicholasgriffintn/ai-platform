# @assistant/api

## 1.0.0

### Major Changes

- f440eb7: Collapse the seven sandbox tools into one `run_sandbox_task` with a `taskType` argument, and add a `sandbox-tasks` skill covering how to pick the type and write a task an unattended run can complete. `run_feature_implementation`, `run_code_review`, `run_test_suite`, `run_bug_fix`, `run_refactoring`, `run_documentation` and `run_migration` are removed.
- f440eb7: Retrieval becomes a tool the model calls. `search_documents` searches the user's own material and returns passages; the `use_rag` request flag, the composer toggle and the RAG settings panel are removed, along with the prompt augmentation that fired on every message whether or not the turn needed it.

  Memory recall splits cleanly: the synthesis stays in the prompt because it is short and always relevant, and per-turn similarity search gives way to `search_memories`, which the model calls when it needs a specific memory.

  Conversation titles are generated as post-turn server work and arrive on the stream, so a first turn no longer costs an extra client round trip. The client still titles conversations the server does not store.

### Minor Changes

- f440eb7: Saved agents now run on the platform prompt. An agent's instructions and few-shot examples become a persona layered into the generated system prompt, so an agent conversation gets safety standards, the skills roster, memory, formatting, channel context and model metadata instead of the agent's own text alone.

  The coding prompt collapses into the standard assembler, which fixes a coding model in agent mode receiving no agent guidelines and a coding model on SMS receiving no channel context.

- 42c36ea: Release the applications from changesets. Merging a changeset that names an application versions it, tags it and publishes a GitHub release with its changelog entry; the desktop release also carries macOS, Windows and Linux archives built on their own runners. The API serves those archives from `/desktop/downloads` and answers the desktop updater from `/desktop/releases`, so neither the website nor the application needs to know where the builds are hosted.
- f440eb7: Run every chat turn through one engine. Streaming and buffered requests now differ only in the transport they hand to the agent loop, so the step budget, tool execution, persistence, usage limits and the goal contract are resolved in one place instead of three.

  Streaming agent turns are now gated by the active goal, which the streaming path previously skipped. Ordinary chat gets the chat mode step budget rather than a single tool round. Memory is classified once per run rather than once per turn, and no longer suppresses goal continuation.

- f440eb7: Second opinions run as a panel. A `second-opinion` skill holds the method and a `second_opinion` tool runs it over `runPanel`, with each reviewer answering on its own model and reading what earlier reviewers said.

  The client no longer builds the review prompt, detects the intent with a regex, or carries the request through message data. The message action sends a plain request and the model chooses the reviewers. `buildOpinionRequestPrompt`, `canRequestOpinionForMessage`, `getOpinionSourceContext`, `OpinionModelPicker` and the `renderOpinionSelector` prop are removed; `CouncilTurnView` becomes `PanelTurnView`, which both panels render through.

### Patch Changes

- f440eb7: `lib/prompts` is the chat system prompt and nothing else. The article, web-search, extract-content and drawing prompts move to the services whose routes they back.

  The prompt no longer compacts itself on small-context models. ADR 0032 found that compact variants drop exactly the detail that prevents a broken result, and the same mechanism was still trimming the principles and metadata sections.

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
- Updated dependencies [2c14529]
- Updated dependencies [1836aad]
- Updated dependencies [19573b8]
  - @ngriffin_uk/polychat-schemas@1.0.0
  - @ngriffin_uk/polychat-utility-core@0.2.0
  - @ngriffin_uk/polychat-library-agent-core@0.2.0
  - @ngriffin_uk/polychat-library-tool-runtime@0.2.0
  - @ngriffin_uk/polychat-library-registry@0.2.0
