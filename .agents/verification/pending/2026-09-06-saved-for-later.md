# Keep a message for later

- **Change:** Any message in a conversation can be kept for later from its action row. Saved messages are personal, even in a shared project. A `list_saved_messages` tool lets a conversation work through what you kept. Migration `0037` adds `message_user_state`.
- **Surfaces:** Web app and API. iOS does not show the action yet.
- **Prerequisites:** Migration `0037`.
- **Risk if wrong:** One person's saved list visible to another, or a message kept from a conversation the saver cannot read.
- **Commits:** This branch.

## Verify

- [x] Keep a message in a personal conversation. Confirm the bookmark fills in, and that it is still filled after a reload.
- [ ] Keep a message in a shared project conversation. Confirm another member of that project does not see it as kept for them.
- [ ] Ask a conversation to work through what you have saved. Confirm the tool lists your saved messages and nobody else's.
- [x] Stop keeping a message and confirm it leaves the list.
- [x] Keep the same message twice and confirm it appears once, with the later save winning.
- [x] Confirm a shared read-only view of a conversation does not offer the action.

**Stop and report if:** a saved message from another person appears in your list, or the tool returns a message from a conversation you cannot open.

## Automated evidence — 7 September 2026

- New local Chromium `features/saved-messages.spec.ts` keeps an assistant reply from its action row, confirms the control switches to Stop keeping this with `aria-pressed`, that `/chat/saved-messages` lists exactly that message, and that both survive a reload.
- Releasing the message returns the control to Keep this for later and empties the list.
- Saving the same message twice leaves one entry carrying the later note.
- A shared read-only view of the same conversation offers neither the keep nor the release control.
- Left open: a project member's separate list, and the `list_saved_messages` tool itself.
