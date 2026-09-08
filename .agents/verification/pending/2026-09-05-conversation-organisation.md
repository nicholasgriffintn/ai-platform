# Conversation organisation

- [x] In personal Chat, pin and unpin a remote conversation and confirm pinned conversations remain first after reload.
- [x] Mark a conversation unread and read, then confirm its marker updates in the list and global search.
- [x] Snooze a conversation until tomorrow, confirm it leaves the ordinary list and Attention, find it through search, clear the snooze and confirm it returns.
- [ ] Snooze until the next agent response and confirm the conversation returns marked unread after a later assistant message, including in global search and Attention.
- [x] Create, assign, remove and delete a personal label; confirm each reverse operation survives reload.
- [x] In Work, confirm a member can assign project labels but only an owner or administrator can create or delete them.
- [x] Remove a person's project membership and confirm organisation reads and mutations fail with the existing conversation access response.
- [x] Open the same organisation dialog in two clients, save from one, then confirm the stale client receives a conflict instead of overwriting it.

## Automated evidence — 7 September 2026

- `features/conversation-organisation.spec.ts` pins a stored conversation with its keyboard shortcut, confirms the marker and that the conversation leads the list after a reload, then unpins it.
- It marks the conversation unread and read again, each surviving a reload, and confirms a snoozed conversation leaves the list, is found through global search marked Snoozed, and returns once the snooze is cleared.
- It creates a group from the conversation menu, confirms the heading appears and survives a reload, moves the conversation out again and confirms the group heading goes.
- In a project it confirms an invited member can open Move to group and pick the owner's group, is not offered Manage groups, and receives 403 from the group creation route.
- Left open: snoozing until the next agent response, membership removal failing organisation reads and mutations, and the two-client conflict.

## Automated browser/API evidence — 8 September 2026

- The corresponding project-access, skill-tools and teammate-feedback journeys passed in `test-results/container/d20cf00c/results.json`. The journey submits two writes with the same observed revision and rejects the stale write with 409. It revokes membership, refuses reads and mutations, restores membership, and confirms the original pinned state persists. This uses real API sessions rather than two open organisation dialogs.
