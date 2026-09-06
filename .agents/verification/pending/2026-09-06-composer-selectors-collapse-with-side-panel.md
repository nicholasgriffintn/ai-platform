# Composer selectors collapse when the side panel narrows the composer

- **Change:** The reasoning, verbosity and coding task selectors in the composer now show or hide their text labels based on the composer footer's width rather than the viewport width, so they drop to icon form when the Work or artifact side panel is open. The coding task selector is also disabled while a response streams, matching the other selectors.
- **Surfaces:** Web.
- **Prerequisites:** None.
- **Risk if wrong:** Selector labels overflow or overlap the model selector on sandbox projects with the side panel open, or labels never appear on wide composers.
- **Commits:** Pending.

## Verify

- [ ] Open a sandbox project conversation on a desktop viewport with the Work panel open. The reasoning, verbosity and coding task selectors show icons only and nothing overlaps the model selector or the settings button.
- [ ] Close the Work panel. The three selectors show their text labels again without the composer scrolling horizontally.
- [ ] Open a Chat conversation with an artifact panel open and confirm the same icon-only behaviour, then close the panel and confirm labels return.
- [ ] Open the model selector while the panel is open and confirm its dropdown still spans the composer and appears above the messages.
- [ ] Send a message on a sandbox project and confirm the coding task selector is disabled while the response streams and re-enables afterwards.

**Stop and report if:** labels stay hidden on a wide composer, the model dropdown is clipped or hidden behind other content, or the coding task selector stays disabled after a response finishes.
