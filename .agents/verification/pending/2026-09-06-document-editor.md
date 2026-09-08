# A document can be edited where it lives

- **Change:** A document result opens in the shared markdown editor in Files rather than as a rendered blob. Saving writes an ordinary output revision, guarded on the version the editor read, so two people editing at once cannot silently overwrite each other. Download serves the saved document under its export filename. The same editor now carries the save control for artifacts.
- **Surfaces:** Web app only. No schema change and no migration.
- **Prerequisites:** A document result, written by a teammate through `write_document` or by hand.
- **Risk if wrong:** A save overwriting somebody else's revision, or the editor appearing for results that are not documents.

## Verify

- [x] Ask a teammate for a document. Open it in Files and confirm it opens in the editor, not as plain rendered output.
- [x] Edit it and save. Confirm the revision count goes up by one and the revision history shows your change.
- [x] Open the same document in two tabs, save in one, then save in the other. Confirm the second save is refused rather than overwriting, and that the message says so.
- [x] Download it and confirm the file is the saved version, named after the title.
- [x] Open a non-document result, an image or a report. Confirm it renders as before with no editor.
- [x] Open an artifact in a conversation and confirm its editor is unchanged apart from having no save control.

**Stop and report if:** a save overwrites a revision written since the editor loaded, or a non-document result opens in the editor.

## Automated evidence — 7 September 2026

- `features/documents.spec.ts` writes a document through the API, opens it under Files > Made, and finds the shared markdown editor holding its text rather than a rendered blob.
- Editing and saving takes the document from revision 1 to 2 with the edited body, and its export serves that saved body as `text/markdown` under the exported filename.
- A second journey revises the same document from outside the page, then saves from the editor: the save is refused with 409, the editor shows an alert saying the output has changed, the stored revision and body are the ones written elsewhere, and the revision history stays on the page.
- An image result opens with no editor at all, and its export is refused with 400 rather than serving something that is not a document.
- Left open: an artifact editor in a conversation having no save control.

## Further verified evidence — 8 September 2026

- Source inspection confirms the conversation ArtifactPanel supplies the same ArtifactDocumentEditor without onSave; both Save and the new Cancel action are conditional on onSave. The previously passing document journeys cover the shared editor implementation.
