# OCR

OCR turns a PDF or raster image into structured text, then stores the complete result as a private Output. Keep input authorisation, output scope, provider execution, and asynchronous batch state inside the OCR service rather than passing private asset URLs to a model or client.

## Configure the capability

OCR currently has one specialised provider: Mistral through Cloudflare AI Gateway. Configure `ACCOUNT_ID`, `AI_GATEWAY_TOKEN`, and an available Mistral API key through the normal provider-key path. A Pro account may use the platform provider key; other access requires the person's configured Mistral key.

Use one of two model names:

- `mistral-ocr-latest` is the default moving alias. It currently resolves to OCR 4.1, but may advance when Mistral moves the alias.
- `mistral-ocr-4-1` pins OCR 4.1 when reproducibility matters.

The specialised OCR API does not route to catalogue models merely because they carry an `ocr` strength. Polychat has no OCR self-hosting adapter and does not integrate Mistral Search Toolkit; this capability only calls Mistral's OCR and Batch APIs.

## Choose an input

Synchronous OCR accepts exactly one input:

- a public HTTP(S) document URL;
- a public HTTP(S) image URL or image data URL;
- an authorised private Source ID; or
- an authorised private Output ID.

Private synchronous inputs must be PDFs up to 25 MiB or AVIF, JPEG, PNG, or WebP images up to 10 MiB. The service reads the private object after authorisation and sends it to Mistral as a data URL; it never gives Mistral a Polychat private URL.

Keep private inputs and results in one scope. A personal run accepts personal Sources and Outputs and creates a personal Output. A project run requires current project access, accepts inputs from that project, and creates a project Output. A Source is attached to the result for provenance; an Output input becomes the new Output's parent. A conversation ID adds provenance and must belong to the same scope—it does not grant access by itself.

Public URLs do not pass through Polychat's private-file MIME and size checks. The upstream provider remains responsible for fetching and accepting them.

## Request structured OCR 4 output

Both synchronous and batch requests can select zero-based pages and request:

- embedded image data, an image count limit, and a minimum image size;
- structured blocks and page, block, or word confidence scores;
- Markdown or HTML tables;
- extracted headers and footers;
- document-level or bounding-box annotations described by JSON Schema; and
- a document annotation prompt when a document annotation schema is also present.

Page selection accepts an integer list or compact ranges such as `0-2,4`. Annotation schemas are limited to 64 KiB and annotation prompts to 16,384 characters. These options are provider features, so callers should tolerate omitted fields when a document contains no matching structure.

## Use synchronous OCR and the tool

`POST /apps/retrieval/ocr` returns the normalised pages, images, tables, links, blocks, confidence data, annotations, and usage. It also stores the full result as a governed Output in JSON, HTML, or Markdown; Markdown is the default. The returned Output URL remains private and uses the normal Output access rules.

The `extract_text_from_document` function uses the same service. It returns up to 20,000 characters of immediately usable extracted text in the tool message, followed by Output metadata and a private download link to the complete persisted result. Running the tool from a project conversation preserves the project and conversation scope.

## Run and monitor a batch

Use the authenticated batch routes below:

- `POST /apps/retrieval/ocr/batches` starts one to 25 requests and returns a pending batch Output ID.
- `GET /apps/retrieval/ocr/batches/:outputId` returns that Output as the status authority.
- `POST /apps/retrieval/ocr/batches/:outputId/cancel` cancels a pending provider job. A terminal batch cannot be cancelled again.

A batch may contain public URLs and authorised private Sources or Outputs. Private raster images are limited to 10 MiB. Private documents are limited to 25 MiB and may be PDF, DOC, DOCX, PPT, PPTX, ODT, or ODP. The complete provider submission is capped at 20 MiB, so inline private files may hit that lower aggregate limit before the per-file limit.

Starting creates an `ocr_batch` Output, submits the Mistral job, and enqueues deterministic polling. The Output's `content.batchStatus` moves through `submitting`, `queued`, `running`, or `cancellation_requested`, with total, completed, succeeded, and failed counts. Polling revalidates project membership, stops after 25 hours, and ignores a batch that is no longer pending.

Success stores provider results as a private NDJSON child Output of kind `ocr_batch_result`. The parent batch becomes `completed` when every item succeeds or `partial` when at least one succeeds. It becomes `failed` when none succeed, the provider fails, the result exceeds the 20 MiB ingestion limit, or polling times out. Cancellation is represented as `content.batchStatus: "cancelled"` on a terminal Output; use `batchStatus`, not only the generic Output status, to distinguish it from failure.

## Keep document conversion separate

OCR does not use Cloudflare Workers AI `toMarkdown` as a fallback. File upload conversion is a separate Source-ingestion path which can request Markdown or plain text and can pass image-description, HTML, and PDF conversion controls. Its compatibility adapter accepts Cloudflare's current `mimetype` response field as well as the older `mimeType` spelling, and handles `markdown`, `text`, and `error` results. A converted Source may then be used as context, while OCR still operates on the original supported private file or an explicit public URL.
