# The desktop app carries the same navigation as the web app

- **Change:** the web app's connected sidebar, headers, page shell, global search and not-found page moved into `packages/component-shell`, and the desktop app now mounts them behind a route table. Destinations the desktop has not migrated answer with the shared 404 page; Ask Poly reports that it has not been migrated instead of doing nothing.
- **Surfaces:** web (every routed page, through the moved shell) and desktop.
- **Prerequisites:** none.
- **Risk if wrong:** the web shell regresses everywhere at once, or the desktop reads an unmigrated path such as `/chat/attention` as a conversation id and shows an empty thread.

## Verify

- [ ] On the web, open a conversation, a Work project and a static page such as `/models`: the sidebar, Chat/Work switch, conversation menus, ⌘K search, keyboard shortcuts, Ask Poly and the settings popover behave as before.
- [ ] On the web, share a conversation from the header and confirm the copied link still points at this origin's `/s/<id>`.
- [ ] On the desktop, sign in and confirm the sidebar lists conversations, that selecting one opens it, and that New chat clears the thread.
- [ ] On the desktop, follow Attention, Files, Teammates and the Work switch: each shows the not-found page rather than an empty conversation.
- [ ] On the desktop, press Ask Poly and confirm it reports that the feature has not been migrated.

**Stop and report if:** a desktop link opens a blank conversation instead of the not-found page, or any web shell control that worked before now does nothing.
