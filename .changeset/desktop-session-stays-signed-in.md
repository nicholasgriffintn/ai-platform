---
"@assistant/desktop": patch
"@ngriffin_uk/polychat-library-client": patch
---

Keep the desktop app signed in as you. A host can now hand the client its own access-token source, which is always sent as a Bearer token and renewed before a request goes out stale. The desktop window no longer lands as an anonymous free user under `tauri dev`, or after waking from sleep, and drops back to sign-in only when the API rejects the session. A failed network check no longer signs anyone out, and signing out of the desktop app now revokes the server session too.
