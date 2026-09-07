---
"@assistant/desktop": minor
---

Keep the desktop application to one window, and let anything on the machine open a conversation in it.

Launching Polychat twice started a second process against the same database and the same keychain entry. A second launch now raises the window that is already running instead.

That window also registers the `polychat://` scheme, so a browser, a terminal, a script or another application can open a conversation directly: `polychat://chat/<conversation-id>` opens that conversation, `polychat://chat/files?tab=made` opens Files. Links arrive as untrusted input, so the window resolves the URL, keeps only the places it actually serves, and refuses anything else rather than navigating; traversal is normalised away by the URL parser and cannot leave the chat root.
