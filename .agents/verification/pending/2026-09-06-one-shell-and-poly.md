# One product shell with places rail, Files, Attention and Poly

- **Change:** Chat and Work render through one `ProductShell` with the Chat and Work toggle in the header and Attention, Files and Teammates links in every sidebar; project conversations use path routes; Files merges Sources and Outputs; Attention is top level with personal tasks; settings tabs are grouped; the Poly overlay runs a `meta` conversation with product-operating tools only.
- **Surfaces:** Web app and API. iOS is unaffected except that conversation deep links may now use the path form.
- **Prerequisites:** None. The `meta` conversation type is a text column value; no migration.
- **Risk if wrong:** Navigation dead ends, broken legacy links, Poly acting on conversations the user cannot access, or meta tools appearing in ordinary chats.
- **Commits:** This branch.

## Verify

- [ ] The Chat and Work toggle appears in the header on Chat, Work, Attention, Files and Teammates pages; each sidebar lists Attention, Files and Teammates under Search, and Ask Poly sits above the settings control in every sidebar footer, including the phone drawer.
- [x] `/chat/teammates` shows the personal library inside the Chat shell, and there is no top-level `/teammates`.
- [ ] New chat from the Work sidebar outside a project opens the workspace and project picker and lands on that project's new conversation; inside a project it starts a conversation there; from Chat or a places page it opens a fresh personal conversation.
- [ ] The profile sidebar rows match the chat sidebar: same padding, radius and hover, grouped sections, a Back to Home row at the top and a quiet Logout row at the bottom; Ask Poly and the settings control share the same full-width hover and active highlight.
- [ ] In Poly, the composer shows a send button, no empty row beneath it, and the pet is Pip whichever pet the user has chosen; "New conversation" sits in the overlay header beside the close control.
- [x] Type into Poly's composer with a draft already in the main chat composer, and confirm neither draft changes the other; sending from one leaves the other intact.
- [ ] Open `/work/<ws>/projects/<p>/chat?completion_id=<id>` and confirm it redirects to `/work/<ws>/projects/<p>/chat/<id>` with the conversation loaded and highlighted in the sidebar.
- [ ] Open `/work/<ws>/projects/<p>/sources` and `/outputs/<id>`; confirm they land on Files › Given and Files › Made respectively, and that `/files` lists personal Given and Made.
- [ ] Open `/work/attention` and confirm it redirects to `/attention`, which shows project attention items and a "Your background tasks" section for a signed-in user.
- [ ] Open `/profile?tab=sources` and `/profile?tab=tasks`; confirm they redirect to Files and Attention, and that the remaining tabs render under the four group headings.
- [x] Open Poly (Ask Poly or ⌘J) while signed in with cloud storage, ask "Archive the conversation I have open", and confirm the open conversation is archived and disappears from the sidebar; the underlying page keeps its own conversation.
- [x] Ask Poly "Open Attention" and confirm the page navigates while the overlay stays open; ask it to find a conversation by title and open it.
- [ ] Confirm Poly's conversation does not appear in the Chat sidebar list or in ⌘K search, and that a signed-out or local-only session sees the explanatory state instead of the composer.
- [x] In an ordinary chat, confirm `find_places` and the other meta tools are not offered or callable.

## Automated evidence — 8 September 2026

- Local Chromium `features/places.spec.ts` opens the personal Teammates place under `/chat/teammates` with the Chat shell and confirms the retired top-level `/teammates` route is not available.
- Poly overlay, meta-tool, profile-sidebar and legacy project-route checks remain open.

**Stop and report if:** Poly archives, opens or reads a conversation the user does not own or is not a project member of, or a meta tool runs from a non-meta conversation.

## Further verified evidence — 8 September 2026

- Container `379708a8` passed both Poly and Discover regressions. Poly preserves the underlying draft and refuses a provider-requested save_skill at the execution boundary; the shared scope filter and supplied-tool regression cover article/recording exclusions and the reverse non-meta restriction. Discover now includes every provider rather than hiding those after the first twelve.

- Container `ff652814` confirms the provider-requested bot task is refused without changing project tasks, and Poly archives the underlying conversation without replacing it. The request context now preserves the bot deny list; 11 API boundary tests also pass. The two separate navigation/snooze failures do not supply check-offs.

- Container 39d294fd passed finding and opening a conversation by title while keeping Poly open. Its mode-navigation journey also passed Chat Files and Attention before the container web runtime crashed during the later Work request; that Work result remains unverified.
