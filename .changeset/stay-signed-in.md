---
"@assistant/api": patch
"@assistant/desktop": patch
"@ngriffin_uk/polychat-library-client": patch
---

Polychat keeps you signed in while you use it.

- **Sessions renew as you go.** Signing in used to last seven days from the moment you signed in, however much you used Polychat in between. A session now extends itself each day you use it on the web or the desktop app, and only lapses after a week away.
- **The desktop app no longer signs you out in the background.** Waking the Mac with no connection, or a brief network drop, used to leave the app looking signed out. It now waits for the connection and carries on, and only shows the sign-in screen when your session has actually ended. Signing in again reuses the session the app already holds before asking you to go through the browser.
