# Review Project Workbench changes and files

- **Change:** Changes now provides ordered file navigation and a syntax-aware unified diff; Files provides changed-file evidence and bounded private artefact previews.
- **Surfaces:** Work project conversations on web and the existing authorised Output content API.
- **Prerequisites:** A completed coding run with a multi-file diff and private run artefacts.
- **Risk if wrong:** Large evidence may overwhelm the browser, review order may hide important contracts, or private content may bypass project access.
- **Commits:** None recorded.

## Verify

- [ ] Open a multi-file run and confirm Changes lists contracts or configuration before consumers and tests, supports file search and next/previous navigation, and renders additions and deletions in a unified diff.
- [ ] Collapse and reopen a diff section using keyboard controls, then repeat at a narrow viewport.
- [ ] Open text and binary entries in Files and confirm text is bounded, binary content is not decoded, and failed or unavailable content has an explicit state.
- [ ] Remove project membership and confirm the same Output ID can no longer load diff or artefact content.

**Stop and report if:** the browser attempts to render an unbounded file, a storage key appears as authority, review navigation traps focus, or a non-member can fetch private evidence.
