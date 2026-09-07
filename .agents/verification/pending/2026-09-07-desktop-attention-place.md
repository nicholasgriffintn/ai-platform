# Attention works the same in the desktop window and on the web

- **Change:** `AttentionPage` moved into `component-shell` and the desktop window serves it at `/chat/attention`.
- **Surfaces:** web, desktop.
- **Prerequisites:** none.
- **Risk if wrong:** Attention stops listing project work or background tasks on the web, or the desktop sidebar keeps leading to a 404.

## Verify

- [ ] On the web, open Attention from the chat sidebar and confirm project items and background tasks both appear.
- [ ] Apply a filter and page through the results, and confirm the address bar keeps the filter after a reload.
- [ ] Open the same page from the Work sidebar and confirm it behaves identically.
- [ ] In the desktop window, open Attention from the sidebar and repeat the list and filter checks.
- [ ] Sign in as an account without a Pro plan and confirm both hosts show the access empty state rather than an error.

**Stop and report if:** Attention lists work from a workspace the signed-in account cannot access.
