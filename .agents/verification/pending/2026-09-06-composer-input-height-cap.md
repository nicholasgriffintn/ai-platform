# Composer input stops growing past the viewport

- **Change:** The tokenised composer input is capped at `min(18rem, 40dvh)` and scrolls internally instead of growing without limit, and the caret is scrolled back into view after the composer re-renders its tokens or after a paste.
- **Surfaces:** Web, desktop shell.
- **Prerequisites:** None.
- **Risk if wrong:** Long drafts push the composer past the bottom of the window and hide the send button, or the caret disappears above the visible input while typing.

## Verify

- [x] Paste several hundred lines into the composer on a desktop viewport. The composer stops growing, the input scrolls, and the send button and footer controls stay on screen.
- [x] Keep typing at the end of that draft and confirm the caret stays visible without manual scrolling.
- [ ] Trigger a slash command or teammate mention so a token is inserted into a long draft, and confirm the caret stays visible and the token renders in place.
- [x] Repeat the paste check on a short window (roughly 600px tall) and on a mobile viewport; the composer should still fit within the viewport.
- [x] Confirm an empty composer still shows its placeholder at its normal single-line height.

**Stop and report if:** the composer still extends past the viewport, the caret is lost while typing near the cap, or the placeholder is clipped or misaligned.

## Automated evidence — 7 September 2026

- New local Chromium `features/composer-size.spec.ts` fills the composer with 400 lines at 1280x720, 1280x600 and 390x844.
- At each size the empty composer stays under a single-line height, the filled input stops at `min(18rem, 40dvh)` while its scroll height keeps growing, and both the input and the send control remain in the viewport with no horizontal page scroll.
- Typing at the end of a capped draft leaves the caret inside the visible input box and the text is appended.
- Left open: the caret after a token is inserted into a long draft by a slash command or mention.
