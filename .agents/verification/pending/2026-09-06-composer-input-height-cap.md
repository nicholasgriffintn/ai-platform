# Composer input stops growing past the viewport

- **Change:** The tokenised composer input is capped at `min(18rem, 40dvh)` and scrolls internally instead of growing without limit, and the caret is scrolled back into view after the composer re-renders its tokens or after a paste.
- **Surfaces:** Web, desktop shell.
- **Prerequisites:** None.
- **Risk if wrong:** Long drafts push the composer past the bottom of the window and hide the send button, or the caret disappears above the visible input while typing.

## Verify

- [ ] Paste several hundred lines into the composer on a desktop viewport. The composer stops growing, the input scrolls, and the send button and footer controls stay on screen.
- [ ] Keep typing at the end of that draft and confirm the caret stays visible without manual scrolling.
- [ ] Trigger a slash command or teammate mention so a token is inserted into a long draft, and confirm the caret stays visible and the token renders in place.
- [ ] Repeat the paste check on a short window (roughly 600px tall) and on a mobile viewport; the composer should still fit within the viewport.
- [ ] Confirm an empty composer still shows its placeholder at its normal single-line height.

**Stop and report if:** the composer still extends past the viewport, the caret is lost while typing near the cap, or the placeholder is clipped or misaligned.
