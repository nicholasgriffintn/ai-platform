# The notification inbox is reachable from Attention in both hosts

- **Change:** `AttentionPage` carries the task notification inbox, and the desktop notifier reads the existing `useTaskAttention` rather than a duplicate hook.
- **Surfaces:** web, desktop.
- **Prerequisites:** none.
- **Risk if wrong:** a desktop notification or badge has nowhere to lead, or reading an item on one host leaves it unread on another.

## Verify

- [ ] With items waiting, open Attention on the web and confirm the inbox lists them beneath the Work attention view.
- [ ] Open an item from the inbox and confirm it lands on the task the notification named.
- [ ] Mark an item read on the web and confirm the desktop badge drops without the desktop being touched.
- [ ] Dismiss an item and confirm it leaves the inbox on both hosts and on iOS.
- [ ] Repeat the open, read and dismiss checks from the desktop window's Attention place.
- [ ] Confirm the Work overview inbox and the Attention inbox agree on the unread count.

**Stop and report if:** the two inboxes disagree, or an item opened in one host stays unread in another.
