# Desktop notifications come from the same inbox as iOS

- **Change:** the desktop notifier reads `/notifications/inbox` and the account's notification preferences instead of polling Work Attention with its own rules.
- **Surfaces:** desktop, iOS and web (shared inbox state).
- **Prerequisites:** none.
- **Risk if wrong:** the desktop announces items iOS would not, ignores a category the account switched off, or marks items read that nobody has looked at.

## Verify

- [ ] With an approval waiting, confirm the desktop badge count matches the unread count the iOS inbox shows for the same account.
- [ ] Turn the Decisions category off in notification settings and confirm the desktop stops announcing approvals while still announcing failures.
- [ ] Turn notifications off entirely and confirm the desktop announces nothing and the badge clears.
- [ ] Read an item on iOS and confirm the desktop badge drops without the desktop having been touched.
- [ ] Confirm the desktop announcing an item does **not** mark it read on iOS or the web.
- [ ] Restart the desktop application and confirm an already-announced item is not announced again.

**Stop and report if:** the desktop marks an inbox item read that the account never opened, or the badge disagrees with the inbox count on another device.
