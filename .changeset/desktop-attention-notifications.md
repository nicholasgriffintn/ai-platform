---
"@assistant/desktop": minor
"@ngriffin_uk/polychat-library-react": minor
---

Let the desktop window tell the operating system when something is waiting on you.

The web application can only surface Attention while a tab is open and, for background notifications, only through web push behind a service worker. A desktop window is already running, so it can say so directly: it polls Attention every two minutes, raises a system notification for approvals, input requests, reviews and failures it has not announced before, and puts the count of those on the application icon.

The announcement ledger lives in the desktop's own database, keyed by account, so restarting the application does not repeat a notification and one account's items never appear for another. A backlog of more than three new items collapses into a single notification rather than a queue of them.

Notifications are raised from Rust rather than granted to the window, so the webview gains no new capability. `library-react` gives `useWorkAttention` an optional polling interval, which the web application does not use.
