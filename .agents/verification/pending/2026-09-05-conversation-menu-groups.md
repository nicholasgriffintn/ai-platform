# Conversation menu offers direct actions and groups replace labels

- **Change:** the conversation actions menu lists Pin, Mark as unread, Snooze, Move to group, Rename and Delete as individual items with single-key shortcuts, replacing the Organise dialog. Labels became groups: each conversation belongs to at most one group and the sidebar renders groups as sections.
- **Surfaces:** web Chat sidebar, web Work project sidebar, API chat organisation routes, global search projection.
- **Prerequisites:** migration `0028_free_toro` drops `conversation_label` and `conversation_label_assignment` and creates `conversation_group` and `conversation_group_membership`. Existing label rows are discarded.
- **Risk if wrong:** organisation actions fail or apply to the wrong conversation, grouped conversations vanish from the sidebar, or project members gain group management they should not have.
- **Commits:** pending.

## Verify

- [ ] In Chat, open a conversation's actions menu, press `P` and confirm the conversation pins and moves to the top; press `P` again to unpin.
- [ ] With the menu open, press `U` and confirm the unread badge toggles; press `R` and `D` and confirm the rename prompt and delete confirmation appear.
- [ ] Open Snooze and choose Until tomorrow; confirm the conversation leaves the list and is still found through search, then clear the snooze from there.
- [ ] Open Move to group, choose Manage groups, create a group and confirm the conversation lands in a new sidebar section named after it. Move it to No group and confirm it returns to the date sections.
- [ ] In a Work project as a member without owner or admin role, confirm Move to group lists project groups but hides Manage groups, and that a `POST /chat/groups` with that project scope returns 403.
- [ ] Confirm a local-only conversation's menu shows only Rename and Delete.

**Stop and report if:** a shortcut fires while a modifier key is held, a group created in one project appears in another, or the migration fails on preview.
