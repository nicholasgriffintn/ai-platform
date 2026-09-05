# Sidebar theme submenu and theme preview colours

- **Change:** The sidebar settings popover no longer focuses the theme control on open. Theme is now a submenu row (like the composer add menu) instead of a native select, and the profile theme preview cards use their own theme's text colours.
- **Surfaces:** Web.
- **Prerequisites:** None.
- **Risk if wrong:** Keyboard users cannot reach the popover's links, the theme cannot be changed from the sidebar, or the theme submenu closes the popover when an option is chosen.
- **Commits:** Pending.

## Verify

- [ ] Open the sidebar settings popover with the mouse. Nothing inside it shows a focus ring and the Theme row is not highlighted.
- [ ] Open the popover with the keyboard, press Tab, and confirm focus moves to the first row inside the popover.
- [ ] Hover or click the Theme row. A submenu opens beside the popover listing System and the seven themes, with the current one ticked. Choosing another theme applies it and leaves the popover open.
- [ ] Repeat the Theme row check on a narrow viewport and confirm the submenu is repositioned to stay on screen.
- [ ] On Profile, Customisation, Theme, switch to a dark theme and confirm the Light, Paper and Dawn preview cards show dark headings and preview text on their light backgrounds, and vice versa on a light theme.

**Stop and report if:** choosing a theme from the submenu closes the popover, the submenu opens off screen, or preview card text is unreadable in either appearance.
