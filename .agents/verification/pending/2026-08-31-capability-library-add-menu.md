# Adding to a capability library is one menu

- **Change:** The capability library replaces its separate add controls with a single **Add** menu listing each authoring choice with a description, and the authoring hook was reworked behind it.
- **Surfaces:** web
- **Prerequisites:** none beyond the release prerequisites. It sits on top of the agents changes, so check `2026-08-31-agents-contract-and-composition.md` first.
- **Risk if wrong:** an authoring route disappears from the menu and the only way to create that capability quietly goes with it.
- **Commits:** `da78d8ac`

## Verify

- [x] Open a project capability library. Confirm the **Add** button opens a menu, and that every capability you can author is listed with a sensible description. _(Local release E2E covers New agent, Attach an agent, and Add a skill.)_
- [ ] Create one of each kind from the menu. Confirm each lands in the library and nothing 404s on the way.
- [ ] Repeat in personal scope. Confirm the choices differ where they should, and that the button is hidden entirely when you can author nothing.
- [x] Open the menu with the keyboard and confirm it is operable, since dropdown behaviour changed in the same release. _(Local release E2E covers focus, arrow keys, Enter, Escape, and focus return in project and personal scope.)_

**Stop and report if:** a capability you could create before this release has no entry in the menu.
