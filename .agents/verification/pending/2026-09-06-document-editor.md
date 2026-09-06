# A document can be edited where it lives

- **Change:** A document result opens in the shared markdown editor in Files rather than as a rendered blob. Saving writes an ordinary output revision, guarded on the version the editor read, so two people editing at once cannot silently overwrite each other. Download serves the saved document under its export filename. The same editor now carries the save control for artifacts.
- **Surfaces:** Web app only. No schema change and no migration.
- **Prerequisites:** A document result, written by a teammate through `write_document` or by hand.
- **Risk if wrong:** A save overwriting somebody else's revision, or the editor appearing for results that are not documents.

## Verify

- [ ] Ask a teammate for a document. Open it in Files and confirm it opens in the editor, not as plain rendered output.
- [ ] Edit it and save. Confirm the revision count goes up by one and the revision history shows your change.
- [ ] Open the same document in two tabs, save in one, then save in the other. Confirm the second save is refused rather than overwriting, and that the message says so.
- [ ] Download it and confirm the file is the saved version, named after the title.
- [ ] Open a non-document result, an image or a report. Confirm it renders as before with no editor.
- [ ] Open an artifact in a conversation and confirm its editor is unchanged apart from having no save control.

**Stop and report if:** a save overwrites a revision written since the editor loaded, or a non-document result opens in the editor.
