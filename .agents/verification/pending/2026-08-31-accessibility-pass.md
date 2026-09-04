# Keyboard and screen-reader pass across the web app

- **Change:** Row actions and overlays are keyboard operable, dropdown menus respond to the keyboard, asynchronous status changes are announced to assistive technology, and the app shell gained landmarks and a skip link.
- **Surfaces:** web
- **Prerequisites:** none beyond the release prerequisites.
- **Risk if wrong:** a focus trap or a runaway live region is far more disruptive than the gap it replaced, and neither shows up in a screenshot.
- **Commits:** `5816cd57` (#2126), `c4813048` (#2133), `e5087c21` (#2127), `9942f732` (#2142)

## Verify

- [x] Load the app and press Tab once. Confirm a skip link appears and jumps to the main content. _(Local release E2E: `Application experience > response policy and keyboard access`.)_
- [x] Navigate the conversation list with the keyboard alone. Confirm every row action is reachable, and that Escape closes an overlay and returns focus to where it was. _(Local release E2E: `Cold conversation history as pro > keeps conversation row actions and overlays keyboard reachable`.)_
- [x] Open a dropdown menu with the keyboard. Confirm arrow keys move through it, Enter selects, Escape closes, and focus does not escape while it is open. _(Local release E2E: `Work experience > pro > offers the complete project and personal capability authoring menus by keyboard`.)_
- [ ] Turn on VoiceOver, send a message, and confirm the streaming and completion states are announced once each rather than repeatedly.
- [ ] Do the same for a long-running action — a generation or an upload — and confirm progress and failure are both announced.
- [ ] Tab through a conversation while a response streams. Confirm focus does not jump around as content arrives.

**Stop and report if:** focus is trapped anywhere, or a live region repeats itself while a response streams. Either is worse than the previous behaviour.
