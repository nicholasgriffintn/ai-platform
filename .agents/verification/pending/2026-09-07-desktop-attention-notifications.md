# The desktop window announces attention through the operating system

- **Change:** the desktop window polls Attention, raises system notifications for items waiting on the account and badges the application icon with the count.
- **Surfaces:** desktop.
- **Prerequisites:** the operating system must grant notification permission on first use; macOS asks once.
- **Risk if wrong:** the same item is announced repeatedly, one account sees another's items, or a backlog produces a wall of notifications.

## Verify

- [ ] Sign in on a Pro account with an approval waiting and confirm one system notification names it and the icon shows a badge.
- [ ] Restart the application and confirm the same item is not announced a second time.
- [ ] Clear the item and confirm the badge returns to nothing.
- [ ] Create more than three new items at once and confirm a single summary notification appears rather than one per item.
- [ ] Sign out, sign in as a different account, and confirm nothing from the first account is announced.
- [ ] Deny notification permission at the operating system level and confirm the window still works and the badge still updates.

**Stop and report if:** a notification names work from an account or workspace the signed-in account cannot access.
