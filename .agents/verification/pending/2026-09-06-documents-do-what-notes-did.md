# Every document does what only notes could

- **Change:** Notes could describe themselves, rewrite themselves and be generated from a recording. Documents, which every teammate writes, could do none of it. Rather than taking those away from notes, they now belong to documents. A document carries a description: a summary, tags, key topics, content type, sentiment, where it came from and its reading preferences. Word count and reading time are derived from the body on every write. `POST /outputs/:outputId/format` rewrites a document and hands the result back without saving. `POST /outputs/:outputId/describe` writes a fresh description against the revision it read. Media generation moved out of notes, where it was only note-shaped in its name.
- **Surfaces:** API and web app. Contract change in `packages/schemas`; no migration. Notes delegate to the shared implementation and behave as before.
- **Prerequisites:** A document result, written by a teammate through `write_document` or by hand.
- **Risk if wrong:** A rewrite saving without being asked, a description overwriting a newer revision, or notes losing a feature in the move.

## Verify

- [ ] Ask a teammate for a document. Open it in Files and confirm a description appears beneath it with a summary, tags and a reading time.
- [x] Confirm the word count and reading time match the document you can see, and change when you edit and save.
- [x] Press Rewrite. Confirm the editor fills with the rewritten draft, that nothing is saved until you press Save, and that Cancel leaves the original intact.
- [x] Press Save after a rewrite and confirm the revision count goes up by one.
- [x] Ask for a fresh description. Confirm it updates and the revision history shows the change.
- [x] Open the same document in two tabs, describe in one, then describe in the other. Confirm the second is refused rather than overwriting.
- [ ] Open a note. Confirm its metadata panel, AI formatting, tags and reading time all behave exactly as before.
- [x] Confirm a note captured from a tab, saved before this change, still shows its capture source. The old field is read and mapped on the way out.
- [ ] Generate a note from a recording and confirm it still works.
- [x] Open a result that is not a document, an image or a report. Confirm no description panel and no Rewrite action appear, and that the format and describe endpoints refuse it.

**Stop and report if:** a rewrite saves itself, a description overwrites a revision written since it was read, or a note loses a feature it had.

## Automated evidence — 8 September 2026, container b2276b14

- `features/documents.spec.ts` opens an image result with neither document metadata nor rewrite controls; both describe and format endpoints refuse it with 400.
- The targeted batch recorded 14 passing journeys and one failing composer assertion. Only the passing journeys support these check-offs.

- The passing stale-description journey in container `b2276b14` changes the stored revision from another writer before the open page asks to regenerate its description. The API returns 409, the page shows the conflict, refreshes its editor and retains the newer revision. This tests the stale-tab invariant using an external body revision rather than spending a provider call to generate the first description.

## Automated browser evidence — 8 September 2026

- The document and app-lifecycle journeys passed in `test-results/container/9b0ba7be/results.json`. They load all seven personal app runtimes from the library, return through the shared back link, refuse unenabled project apps, preserve note autosaves across reopening, and verify cancellable document drafts, word counts, saved revisions and fresh descriptions. Outbound document generation is deterministic; local API persistence and UI are real.

- Container `35dc5b98` passed the bot editor and legacy note capture journeys. Forbidden tools disappear, stay absent after saving and reopening, and the older tab-source title and link remain visible. The separate run-lifecycle journey failed and supplies no completed check-off.
