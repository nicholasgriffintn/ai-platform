# Four further theme palettes, themed toasts and guest theme access

- **Change:** Added Paper and Dawn (light) and Fern and Plum (dark) palettes; toasts now follow the resolved theme rather than the operating system; the sidebar settings popover carries a compact theme select for guests; a pre-registry `theme` storage key is migrated once; the web manifest colours match the server-rendered dark shell.
- **Surfaces:** Web application shell, Customisation theme picker, sidebar settings popover, toast region, browser chrome colour and installed-app splash.
- **Prerequisites:** None.
- **Risk if wrong:** A new palette may leave a control without contrast, a toast may render in the wrong appearance, or a guest may still be unable to change theme.
- **Commits:** None yet.

## Verify

- [ ] Open Customisation and confirm eight options render: System, Light, Paper, Dawn, Dark, Blue, Fern and Plum. Each card is painted entirely in its own palette and shows the name, appearance and canvas hex, the description, a small composer mock and six role chips; the System card splits into a light and a dark half. The selected card carries an outline in its own accent, and keyboard focus is visible on every card. Select each and confirm the whole shell, sidebar, composer, cards and menus follow, and that a reload keeps the choice without a flash.
- [ ] In Paper and Dawn, check primary text, muted text, focus rings, the send action and selected sidebar items against the canvas and surfaces. In Fern confirm the primary action reads as a solid orange fill with a dark label; in Plum confirm it reads as a violet fill with a near-white label.
- [ ] In each new theme, check a capability grid, the model picker and a provider badge: identity accents should stay distinguishable and legible.
- [ ] Set the operating system to light, choose Dark or Fern in the app, then trigger a toast (for example copy a message). Confirm the toast renders dark. Repeat with the operating system dark and Light or Paper chosen; the toast should render light.
- [ ] Sign out. Open the sidebar settings popover and confirm a Theme select is present above Keyboard shortcuts. Choose Plum and confirm the shell changes immediately and survives a reload.
- [ ] In a browser where the old `theme` local storage key is set to `dark` and `polychat-theme` is absent, load the app. Confirm it opens in Dark without a flash, that `polychat-theme` now holds `dark` and the old key is gone.
- [ ] Switch theme on a mobile browser and confirm the browser chrome colour follows for the four new palettes. Install the app to the home screen and confirm the splash background is the dark shell rather than white or pure black.

**Stop and report if:** Any text or control loses contrast in a new palette, a toast renders in the wrong appearance, or a guest cannot change theme from the sidebar.
