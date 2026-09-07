---
"@assistant/desktop": minor
"@ngriffin_uk/polychat-component-shell": minor
"@ngriffin_uk/polychat-library-react": patch
---

Put the notification inbox on the Attention place, so every host has somewhere to act on a notification.

Two corrections to the previous change.

`useTaskInbox` should never have existed: `useTaskAttention` in `library-react` already ran the same query with the same read and dismiss receipts, and already polled. The desktop notifier uses it, and the duplicate is gone. It also polls on its own, so `useWorkAttention` needs no interval option either.

The claim that the web had no inbox was wrong. It had one, on the Work overview, behind a route the desktop answers with a 404 — which is why the desktop had a badge and notifications with nowhere to go. `AttentionPage` now carries the same inbox, built from the same `TaskAttentionList` the Work overview uses, so both hosts can open, read and dismiss an item from the place their sidebar already links to.
