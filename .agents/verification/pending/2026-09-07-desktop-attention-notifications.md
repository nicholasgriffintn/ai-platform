# Desktop attention notifications and dock badge

- **Change:** reconstructed the truncated `announce_attention` match arms and the mangled `set_attention_badge` body in the desktop Tauri shell. Both were committed in a state that never compiled, so neither path has ever run.
- **Surfaces:** desktop (macOS/Windows/Linux Tauri shell) only.
- **Prerequisites:** none.
- **Risk if wrong:** attention items announce the wrong text, announce nothing, announce repeatedly across restarts, or the dock badge never clears.

## Verify

- [ ] Trigger one or two attention items and confirm each raises its own notification carrying that item's title and body.
- [ ] Trigger more than three at once and confirm a single "Polychat" notification reporting the total count instead of individual ones.
- [ ] Restart the app and confirm already-announced items do not announce again.
- [ ] Confirm the dock/taskbar badge shows the outstanding count and disappears entirely when the count reaches zero.

**Stop and report if:** an item announces twice across a restart, the badge persists at zero, or the summary notification reports a count that does not match the items waiting.
