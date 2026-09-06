# ADR 0072: One shell and one user-facing vocabulary

Status: Accepted.

Chat and Work ran through two page shells with different sidebars, header compositions and conversation route shapes, and the product exposed seven capability nouns and an eleven-tab settings page before a new person saw value. The runtime was already shared; the presentation was not.

## Decision

Render every product route through one `ProductShell`: a sidebar, the header with the Chat and Work toggle, and the content column. Chat and Work keep their own sidebars but share the shell, the header primitives and the conversation route shape: `/chat/:conversationId?` and `/work/:workspaceId/projects/:projectId/chat/:conversationId?`. The `completion_id` query parameter is a legacy input that redirects to the path form.

Every sidebar carries the same places under Search: Attention, Files and Teammates, at `/attention`, `/files` and `/teammates`. Those pages use the standard sidebar, which also carries the Discover links. Attention combines project task and run state with the person's own background tasks. Files merges Sources and Outputs as Given and Made, personally and per project, with the old sources and outputs routes redirecting. Teammates is the personal capability library, and `/chat/capabilities` redirects to it. Poly sits in every sidebar footer above the settings control. Settings groups its tabs into Account, Appearance and pet, Models and keys and Advanced; personal data surfaces move to their places rather than living behind the gear.

User-facing names change without renaming records: experiences are Apps, the capability library is Teammates and tools, sources and outputs are Files. The Saved outputs experience is retired because Files › Made is the same view. The catalogue no longer carries an `href`; paths derive from scope and App ID. Chat and Work open Apps through one `AppRoute` with a scope prop.

## Trade-off

Two navigation destinations (Experiences in each sidebar) disappear, so Apps are reached through the library, deep links and the composer rather than a sidebar item. Attention, Files and Teammates are shared places rather than mode-specific ones, so a project's own Files and Tasks stay in the project sidebar. UI names now differ from schema names for recipes, experiences, sources and outputs, which the vocabulary table in [context](../context.md) must keep mapped. iOS keeps its own navigation and consumes the same routes.
