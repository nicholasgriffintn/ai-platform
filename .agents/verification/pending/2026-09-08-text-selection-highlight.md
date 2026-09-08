# Selected text is visible in every theme

- **Change:** `::selection` now uses a dedicated `--polychat-highlight` token per theme instead of `--polychat-selection`, which doubles as the user message bubble background and every hover tint. Inputs use the same token rather than the primary colour.
- **Surfaces:** Web, desktop shell.
- **Prerequisites:** None.
- **Risk if wrong:** Selecting text inside a user message, a hovered row, a kbd chip or an active tab paints it the colour it already is, so the selection is invisible.

## Verify

- [ ] In each theme (light, paper, dawn, dark, blue, fern, plum), drag-select text inside a user message bubble and confirm the highlight is clearly visible and the text stays readable.
- [ ] Repeat over an assistant message, a hovered sidebar row, an active tab and a keyboard shortcut chip.
- [ ] Select text inside the composer and a settings text input; the highlight should match the rest of the app.
- [ ] Confirm the user bubble, hover tints, skeletons and active tabs still use the previous subtle tint and have not changed colour.

**Stop and report if:** any theme still shows an invisible or low-contrast selection, or the highlight colour bleeds into surfaces that should stay subtle.
