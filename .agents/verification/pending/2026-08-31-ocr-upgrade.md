# OCR gained structured output and batches

- **Change:** OCR now runs Mistral OCR 4.1 through AI Gateway, accepts a public URL or an authorised private Source or Output, and returns structured blocks, confidence scores, tables, headers and footers, and annotations. The full result is stored as a governed Output in Markdown, HTML, or JSON, and one to 25 requests can be queued as a batch. Private inputs are read after authorisation and sent as data URLs, never as Polychat private URLs.
- **Surfaces:** API, web
- **Prerequisites:** `ACCOUNT_ID`, `AI_GATEWAY_TOKEN`, and a Mistral key — the platform key for Pro, otherwise the person's own. See `references/operations/ocr.md`.
- **Risk if wrong:** a private document is sent somewhere it should not go, or an OCR Output lands in the wrong scope.
- **Commits:** `bd2e059c` (#2162)

## Verify

- [ ] Run `POST /apps/retrieval/ocr` against a public PDF URL. Confirm pages, tables, and usage come back and an Output is created.
- [ ] Run it against a private Source you own. Confirm it works, and that the resulting Output is personal and private.
- [ ] Run the same private Source ID as a different account. Confirm it is refused.
- [ ] Run OCR inside a project. Confirm the Output is a project Output, and that a personal Source is not accepted there.
- [ ] Ask a chat to read a document with `extract_text_from_document`. Confirm the text appears in the answer and the download link resolves only for you.
- [ ] Request page ranges, tables, and a document annotation schema. Confirm the options are honoured, and that a document with no matching structure omits fields rather than erroring.
- [ ] Push a private file past the documented limits — a PDF over 25 MiB, or an image over 10 MiB. Confirm a clear refusal.
- [ ] Start a batch of a few requests, poll it, and confirm it completes and each result is retrievable. Then confirm deleting an OCR Output removes the stored result.

**Stop and report if:** any response contains a Polychat private URL handed to the provider, or an Output appears in a scope other than the one that ran it.
