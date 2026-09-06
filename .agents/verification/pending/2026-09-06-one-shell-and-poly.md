# One product shell with places rail, Files, Attention and Poly

- **Change:** Chat and Work render through one `ProductShell` with a places rail; project conversations use path routes; Files merges Sources and Outputs; Attention is top level with personal tasks; settings tabs are grouped; the Poly overlay runs a `meta` conversation with product-operating tools only.
- **Surfaces:** Web app and API. iOS is unaffected except that conversation deep links may now use the path form.
- **Prerequisites:** None. The `meta` conversation type is a text column value; no migration.
- **Risk if wrong:** Navigation dead ends, broken legacy links, Poly acting on conversations the user cannot access, or meta tools appearing in ordinary chats.
- **Commits:** This branch.

## Verify

- [ ] On desktop the rail shows Chat, Work, Attention, Files, Teammates, Poly and You; on a phone-width viewport it sits along the bottom and the sidebar still opens as a drawer.
- [ ] Open `/work/<ws>/projects/<p>/chat?completion_id=<id>` and confirm it redirects to `/work/<ws>/projects/<p>/chat/<id>` with the conversation loaded and highlighted in the sidebar.
- [ ] Open `/work/<ws>/projects/<p>/sources` and `/outputs/<id>`; confirm they land on Files › Given and Files › Made respectively, and that `/files` lists personal Given and Made.
- [ ] Open `/work/attention` and confirm it redirects to `/attention`, which shows project attention items and a "Your background tasks" section for a signed-in user.
- [ ] Open `/profile?tab=sources` and `/profile?tab=tasks`; confirm they redirect to Files and Attention, and that the remaining tabs render under the four group headings.
- [ ] Open Poly (rail button or ⌘J) while signed in with cloud storage, ask "Archive the conversation I have open", and confirm the open conversation is archived and disappears from the sidebar; the underlying page keeps its own conversation.
- [ ] Ask Poly "Open Attention" and confirm the page navigates while the overlay stays open; ask it to find a conversation by title and open it.
- [ ] Confirm Poly's conversation does not appear in the Chat sidebar list or in ⌘K search, and that a signed-out or local-only session sees the explanatory state instead of the composer.
- [ ] In an ordinary chat, confirm `find_places` and the other meta tools are not offered or callable.

**Stop and report if:** Poly archives, opens or reads a conversation the user does not own or is not a project member of, or a meta tool runs from a non-meta conversation.
