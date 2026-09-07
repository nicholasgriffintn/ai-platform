# ADR 0004: Render one shell with one user-facing vocabulary

Status: Implemented.

## Problem

Chat and Work ran through two page shells with different sidebars, header compositions and conversation route shapes, and the product exposed seven capability nouns and an eleven-tab settings page before a new person saw value. The runtime was already shared; the presentation was not.

A returning member wants the composer and nothing else, but a stranger arriving from a link saw a composer with no account of what the product is. A separate marketing site would fix the second problem by breaking the first, because the composer that works before sign-in is the differentiator.

## Decision

Render every product route through one `ProductShell`: a sidebar, the header with the Chat and Work toggle, and the content column. Chat and Work keep their own sidebars but share the shell, the header primitives and the conversation route shape: `/chat/:conversationId?` and `/work/:workspaceId/projects/:projectId/chat/:conversationId?`. The `completion_id` query parameter is a legacy input that redirects to the path form.

Every sidebar carries the same places under Search: Attention, Files and Teammates, at `/attention`, `/files` and `/teammates`. Attention combines project task and run state with the person's own background tasks. Files merges Sources and Outputs as Given and Made, personally and per project. Teammates is the personal capability library. Poly sits in every sidebar footer above the settings control. Settings groups its tabs into Account, Appearance and pet, Models and keys, and Advanced.

User-facing names change without renaming records: experiences are Apps, the capability library is Teammates and tools, and sources and outputs are Files. The catalogue carries no `href`; paths derive from scope and app ID.

The home route stays the application. For a guest with no conversation open, a product tour renders beneath the welcome screen in the same scroll container, after the fold; nothing promotional sits above the composer. The tour is one lazily loaded module of bands fed by data the application already holds — the model registry, the capability catalogue, the plan list and the pet lore — so a band cannot drift from the product. The same bands render on `/discover` with per-band anchors, so any band can be linked and indexed.

## Consequences

Apps are reached through the library, deep links and the composer rather than a sidebar item. Attention, Files and Teammates are shared places, so a project's own Files and Tasks stay in the project sidebar. UI names differ from schema names for recipes, experiences, sources and outputs, which the vocabulary table in [context](../context.md) must keep mapped. iOS keeps its own navigation and consumes the same routes.

A guest's first page is longer, though nothing in the tour blocks the composer. The bands describe the product in prose that must be edited when features change. Members reach the tour only from the standard sidebar, which is a deliberate limit.
