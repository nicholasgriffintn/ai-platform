# Keep a message for later

- **Change:** Any message in a conversation can be kept for later from its action row. Saved messages are personal, even in a shared project. A `list_saved_messages` tool lets a conversation work through what you kept. Migration `0037` adds `message_user_state`.
- **Surfaces:** Web app and API. iOS does not show the action yet.
- **Prerequisites:** Migration `0037`.
- **Risk if wrong:** One person's saved list visible to another, or a message kept from a conversation the saver cannot read.
- **Commits:** This branch.

## Verify

- [ ] Keep a message in a personal conversation. Confirm the bookmark fills in, and that it is still filled after a reload.
- [ ] Keep a message in a shared project conversation. Confirm another member of that project does not see it as kept for them.
- [ ] Ask a conversation to work through what you have saved. Confirm the tool lists your saved messages and nobody else's.
- [ ] Stop keeping a message and confirm it leaves the list.
- [ ] Keep the same message twice and confirm it appears once, with the later save winning.
- [ ] Confirm a shared read-only view of a conversation does not offer the action.

**Stop and report if:** a saved message from another person appears in your list, or the tool returns a message from a conversation you cannot open.
