# Finished work comes back as a document

- **Change:** A `write_document` tool saves a document as a durable result of kind `document`, in the caller's personal scope or a project, with the conversation it came from recorded. Passing an `outputId` revises the existing document rather than writing a second copy, guarded on the revision it read. Documents export as Markdown from a new `/outputs/:outputId/export` route.
- **Surfaces:** API. Documents appear in Files under Made like any other result.
- **Prerequisites:** None. The output kind is a free-form string, so no schema change.
- **Risk if wrong:** A document written into a project the caller cannot access, a revision overwriting a concurrent edit, or the export route serving something that is not a document.
- **Commits:** This branch.

## Verify

- [ ] Ask for a brief or a report. Confirm it comes back as a document, appears in Files under Made, and opens with its full text.
- [x] Ask for a change to that document. Confirm the revision number goes up and there is one document, not two.
- [x] Export it and confirm you get a Markdown file named after the title.
- [ ] Ask for a document inside a project. Confirm it belongs to that project and that a non-member cannot open it.
- [x] Call the export route against a result that is not a document, such as an image, and confirm it is refused rather than returning nonsense.
- [x] Revise the same document from two places and confirm the second is refused rather than silently overwriting.

**Stop and report if:** a document is written into a project the caller cannot access, or a revision overwrites one written since it was read.

## Automated evidence — 7 September 2026

- `features/documents.spec.ts` writes a document of kind `document`, finds it under Files > Made, and revises it in place: the revision goes to 2 and there is one output, not two.
- `/outputs/:outputId/export` returns the saved body as `text/markdown` under the title-derived filename, and refuses an image result with 400 and an explicit reason.
- Revising the same document from two places leaves the first write standing and refuses the second with 409.
- Left open: asking a teammate for a document through `write_document` itself, and a document written into a project a non-member cannot open.
