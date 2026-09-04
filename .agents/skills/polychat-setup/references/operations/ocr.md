# Operate OCR

OCR extracts structured text and stores the complete result as a private Output. The specialised adapter uses Mistral through Cloudflare AI Gateway; configure `ACCOUNT_ID`, `AI_GATEWAY_TOKEN` and an eligible platform or personal Mistral key. Use the shared OCR schemas for supported model names and options; a moving alias is not a version pin.

## Input and scope

Synchronous OCR accepts one public document/image URL, image data URL, authorised Source ID or authorised Output ID. Private files are PDFs up to 25 MiB or supported raster images up to 10 MiB. The service authorises and sends private bytes, never a private Polychat URL. Public URL acceptance is handled upstream and does not inherit those private-file checks.

Keep input, output and optional conversation provenance in one personal or project scope. Project access requires current membership. Source inputs retain provenance; Output inputs become parents of the new result.

`POST /apps/retrieval/ocr` and `extract_text_from_document` use the same service. The tool returns a bounded excerpt plus private Output metadata for the full result. Use `packages/schemas/src/ocr.ts` for page selection, structured blocks, confidence, tables and annotation options.

## Batches

- `POST /apps/retrieval/ocr/batches` submits up to 25 requests and returns a pending batch Output.
- `GET /apps/retrieval/ocr/batches/:outputId` reads status.
- `POST /apps/retrieval/ocr/batches/:outputId/cancel` requests cancellation of pending work.

Batch private documents support more office formats than synchronous OCR. The aggregate submission is capped at 20 MiB, so inline files can reach that limit before the individual file limit. Consult `ocr-batch.ts` and the input service for accepted formats and bounds.

Polling revalidates project access and has a finite timeout. Successful results become a private NDJSON child Output. The parent distinguishes complete, partial and failed outcomes; use `content.batchStatus` to distinguish cancellation from generic terminal failure. A terminal batch cannot be cancelled again.

File-upload conversion through Workers AI is a separate Source-ingestion path, not an OCR fallback. Keep original-file selection and converted context distinct.
