# Every document does what only notes could

- **Change:** Notes could describe themselves, rewrite themselves and be generated from a recording. Documents, which every teammate writes, could do none of it. Rather than taking those away from notes, they now belong to documents. A document carries a description: a summary, tags, key topics, content type, sentiment, where it came from and its reading preferences. Word count and reading time are derived from the body on every write. `POST /outputs/:outputId/format` rewrites a document and hands the result back without saving. `POST /outputs/:outputId/describe` writes a fresh description against the revision it read. Media generation moved out of notes, where it was only note-shaped in its name.
- **Surfaces:** API and web app. Contract change in `packages/schemas`; no migration. Notes delegate to the shared implementation and behave as before.
- **Prerequisites:** A document result, written by a teammate through `write_document` or by hand.
- **Risk if wrong:** A rewrite saving without being asked, a description overwriting a newer revision, or notes losing a feature in the move.

## Verify

- [ ] Ask a teammate for a document. Open it in Files and confirm a description appears beneath it with a summary, tags and a reading time.
- [ ] Confirm the word count and reading time match the document you can see, and change when you edit and save.
- [ ] Press Rewrite. Confirm the editor fills with the rewritten draft, that nothing is saved until you press Save, and that Cancel leaves the original intact.
- [ ] Press Save after a rewrite and confirm the revision count goes up by one.
- [ ] Ask for a fresh description. Confirm it updates and the revision history shows the change.
- [ ] Open the same document in two tabs, describe in one, then describe in the other. Confirm the second is refused rather than overwriting.
- [ ] Open a note. Confirm its metadata panel, AI formatting, tags and reading time all behave exactly as before.
- [ ] Confirm a note captured from a tab, saved before this change, still shows its capture source. The old field is read and mapped on the way out.
- [ ] Generate a note from a recording and confirm it still works.
- [ ] Open a result that is not a document, an image or a report. Confirm no description panel and no Rewrite action appear, and that the format and describe endpoints refuse it.

**Stop and report if:** a rewrite saves itself, a description overwrites a revision written since it was read, or a note loses a feature it had.
