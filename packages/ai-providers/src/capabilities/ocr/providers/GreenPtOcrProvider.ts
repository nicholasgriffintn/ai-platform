import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { base64ToBuffer } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import {
  fetchFollowingSafeRedirects,
  parsePublicHttpUrl,
  readResponseBytesWithinLimit,
  ResponseBodyTooLargeError,
  UnsafeUrlError,
} from "@ngriffin_uk/polychat-utility-server/http";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import z from "zod/v4";

import type { ProviderRuntime } from "../../../runtime.js";
import { formatProviderError } from "../../../utils/errors.js";
import { greenPtRequest, resolveGreenPtApiKey } from "../../../utils/greenpt.js";
import { requireOcrAccess } from "../access.js";
import {
  buildOcrMarkdown,
  normaliseOcrResponse,
  persistOcrOutput,
  type OcrApiResponse,
} from "../format.js";
import type {
  OcrDocument,
  OcrExtractionRequest,
  OcrExtractionResult,
  OcrProvider,
} from "../types.js";

const logger = getLogger({ prefix: "lib/providers/ocr/greenpt" });
const MAX_INLINE_OCR_TEXT_LENGTH = 20_000;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:([^;,]+)?(;base64)?,(.*)$/s;

export const GREENPT_OCR_MODEL = "greenpt-documents";

const greenPtDocumentResponseSchema = z.object({
  document: z
    .object({
      filename: z.string().optional(),
      md_content: z.string().nullable().optional(),
      text_content: z.string().nullable().optional(),
      html_content: z.string().nullable().optional(),
    })
    .optional(),
  status: z.string().optional(),
  errors: z.array(z.unknown()).optional(),
  processing_time: z.number().optional(),
});

type GreenPtDocumentResponse = z.infer<typeof greenPtDocumentResponseSchema>;

interface LoadedDocument {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}

function resolveDocumentSource(document: OcrDocument): { url: string; filename: string } {
  if (document.type === "file") {
    throw new AssistantError(
      "GreenPT documents require a document_url or image_url input",
      ErrorType.PARAMS_ERROR,
    );
  }

  if (document.type === "image_url") {
    return { url: document.image_url, filename: "image" };
  }

  return { url: document.document_url, filename: document.document_name ?? "document" };
}

function decodeDataUrl(url: string): { bytes: Uint8Array; mimeType: string } {
  const match = DATA_URL_PATTERN.exec(url);

  if (!match) {
    throw new AssistantError("Invalid data URL", ErrorType.PARAMS_ERROR);
  }

  const mimeType = match[1] || "application/octet-stream";
  const payload = match[3] ?? "";

  return {
    mimeType,
    bytes: match[2]
      ? base64ToBuffer(payload)
      : new TextEncoder().encode(decodeURIComponent(payload)),
  };
}

function assertDocumentSize(byteLength: number): void {
  if (byteLength > MAX_DOCUMENT_BYTES) {
    throw new AssistantError("Document must be 25MB or smaller", ErrorType.PARAMS_ERROR, 400);
  }
}

export function mapPageRange(pages: OcrExtractionRequest["pages"]): string | undefined {
  if (pages === undefined) {
    return undefined;
  }

  const numbers = Array.isArray(pages)
    ? pages
    : pages.split(",").flatMap((part) => {
        const bounds = part.split("-").map(Number);
        const start = bounds[0] ?? Number.NaN;
        const end = bounds[1] ?? start;

        return Number.isInteger(start) && Number.isInteger(end) && end >= start
          ? Array.from({ length: end - start + 1 }, (_value, index) => start + index)
          : [];
      });

  if (numbers.length === 0) {
    return undefined;
  }

  const ordered = [...new Set(numbers)].sort((left, right) => left - right);

  if (
    ordered.slice(1).some((page, index) => {
      const previousPage = ordered[index];

      return previousPage === undefined || page !== previousPage + 1;
    })
  ) {
    throw new AssistantError(
      "GreenPT OCR supports one continuous page range",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const firstPage = ordered[0];
  const lastPage = ordered.at(-1);

  if (firstPage === undefined || lastPage === undefined) {
    return undefined;
  }

  return `${firstPage + 1},${lastPage + 1}`;
}

export function buildGreenPtOcrResponse(
  data: GreenPtDocumentResponse,
  byteLength: number,
): OcrApiResponse {
  const markdown = data.document?.md_content ?? data.document?.text_content ?? "";

  return {
    model: GREENPT_OCR_MODEL,
    pages: [{ index: 0, markdown, images: [], tables: [], hyperlinks: [] }],
    usage_info: { pages_processed: markdown ? 1 : 0, doc_size_bytes: byteLength },
  };
}

export class GreenPtOcrProvider implements OcrProvider {
  constructor(protected readonly runtime: ProviderRuntime) {}

  name = "greenpt";
  models = [GREENPT_OCR_MODEL];

  async extractText(request: OcrExtractionRequest): Promise<OcrExtractionResult> {
    try {
      if (!request.document) {
        throw new AssistantError("Document is required", ErrorType.PARAMS_ERROR);
      }

      if (!request.user?.id) {
        throw new AssistantError("User data required", ErrorType.AUTHENTICATION_ERROR);
      }

      await requireOcrAccess(this.runtime.host, {
        env: request.env,
        user: request.user,
        providerName: this.name,
      });

      const requestId = request.id || generateId();
      const loaded = await this.loadDocument(request.document);
      const apiKey = await resolveGreenPtApiKey(this.runtime.host, {
        env: request.env,
        userId: request.user.id,
      });
      const rawResponse = await greenPtRequest({
        apiKey,
        path: "/tools/documents/convert/file",
        body: this.buildFormData(request, loaded),
        label: "GreenPT document conversion",
      });
      const parsed = greenPtDocumentResponseSchema.safeParse(rawResponse);

      if (!parsed.success) {
        throw new AssistantError(
          "GreenPT returned an unexpected document conversion payload",
          ErrorType.PROVIDER_ERROR,
          502,
        );
      }

      const data = parsed.data;

      if (data.status && data.status !== "completed" && data.status !== "success") {
        throw new AssistantError(
          `GreenPT document conversion ${data.status}`,
          ErrorType.EXTERNAL_API_ERROR,
        );
      }

      const response = buildGreenPtOcrResponse(data, loaded.bytes.byteLength);
      const outputFormat = request.output_format ?? "markdown";
      const storage = this.runtime.host.storage.forContext({
        env: request.env,
        user: request.user,
      });

      if (!storage) {
        throw new AssistantError(
          "Storage is not configured for OCR output",
          ErrorType.CONFIGURATION_ERROR,
        );
      }

      const asset = await persistOcrOutput({
        requestId,
        response,
        outputFormat,
        storage,
        ownerUserId: request.user.id,
        projectId: request.projectId,
        conversationId: request.conversationId,
        parentOutputId: request.parentOutputId,
      });

      return {
        model: GREENPT_OCR_MODEL,
        ...asset,
        extractedText: buildOcrMarkdown(response).slice(0, MAX_INLINE_OCR_TEXT_LENGTH),
        response: normaliseOcrResponse(response),
      };
    } catch (error) {
      logger.error("GreenPT OCR error:", { error });

      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        await formatProviderError(error, "GreenPT OCR error"),
        ErrorType.EXTERNAL_API_ERROR,
      );
    }
  }

  private async loadDocument(document: OcrDocument): Promise<LoadedDocument> {
    const { url, filename } = resolveDocumentSource(document);

    if (url.startsWith("data:")) {
      const decoded = decodeDataUrl(url);

      assertDocumentSize(decoded.bytes.byteLength);

      return { ...decoded, filename };
    }

    let parsed: URL;

    try {
      parsed = parsePublicHttpUrl(url);
    } catch {
      throw new AssistantError("Document URL must be a public HTTP(S) URL", ErrorType.PARAMS_ERROR);
    }

    let response: Response;

    try {
      response = await fetchFollowingSafeRedirects(parsed);
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        throw new AssistantError(
          "Document URL must remain a public HTTP(S) URL after redirects",
          ErrorType.PARAMS_ERROR,
        );
      }

      throw error;
    }

    if (!response.ok) {
      throw new AssistantError(
        await formatProviderError(response, "Failed to download document"),
        ErrorType.EXTERNAL_API_ERROR,
      );
    }

    let bytes: Uint8Array;

    try {
      bytes = await readResponseBytesWithinLimit(response, MAX_DOCUMENT_BYTES);
    } catch (error) {
      if (error instanceof ResponseBodyTooLargeError) {
        throw new AssistantError("Document must be 25MB or smaller", ErrorType.PARAMS_ERROR, 400);
      }

      throw error;
    }

    return {
      bytes,
      filename,
      mimeType: response.headers.get("content-type")?.split(";")[0] || "application/octet-stream",
    };
  }

  private buildFormData(request: OcrExtractionRequest, loaded: LoadedDocument): FormData {
    const formData = new FormData();
    const pageRange = mapPageRange(request.pages);

    formData.append(
      "files",
      new Blob([new Uint8Array(loaded.bytes)], { type: loaded.mimeType }),
      loaded.filename,
    );
    formData.append("to_formats", "md");
    formData.append("do_ocr", "true");
    formData.append("do_table_structure", "true");
    formData.append("table_mode", "accurate");
    formData.append("include_images", request.include_image_base64 ? "true" : "false");
    formData.append("image_export_mode", request.include_image_base64 ? "embedded" : "placeholder");

    if (pageRange) {
      formData.append("page_range", pageRange);
    }

    return formData;
  }
}
