# Browse and search models across locations

- **Change:** replace the source dropdown with tabs, move Auto into the category rail, show a synced Last used choice, and search across available locations without loading WebLLM.
- **Surfaces:** shared web and desktop picker; API account settings. Native iOS ignores the optional new setting.
- **Prerequisites:** apply `apps/api/migrations/0050_brave_goblin_queen.sql` before deploying the updated API. Remote migration and deployment require operator authority.
- **Risk if wrong:** missing account settings, incorrect model location, or unresponsive search.

## Verify

- [ ] Confirm the header keeps its previous height and Auto has no extra outer padding on narrow and wide layouts.
- [ ] Search while Cloud is selected; confirm All locations is highlighted, results identify devices, and typing stays responsive. Confirm no WebLLM engine request or model download occurs until a browser model is selected.
- [ ] Click Cloud during search; confirm the search clears and Cloud browsing returns.
- [ ] Select an available model on another machine; confirm the picker closes and the composer identifies that machine.
- [ ] Open the picker on a second signed-in device and confirm Last used matches. Disconnect the saved machine and confirm the shortcut stays visible but disabled; reconnect and retry.
- [ ] Simulate a settings save failure; confirm the current selection remains usable and the sync error is visible.

**Stop and report if:** searching crashes the app, selecting a location launches the wrong model, the unavailable shortcut executes, or unrelated account settings change.
