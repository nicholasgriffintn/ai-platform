import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { isPrivateHostname } from "@ngriffin_uk/polychat-utility-core";
import { base64ToBuffer } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

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

interface GreenPtDocumentResponse {
  document?: {
    filename?: string;
    md_content?: string | null;
    text_content?: string | null;
    html_content?: string | null;
  };
  status?: string;
  errors?: unknown[];
  processing_time?: number;
}

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

  return `${Math.min(...numbers) + 1},${Math.max(...numbers) + 1}`;
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
      const data = await greenPtRequest<GreenPtDocumentResponse>({
        apiKey,
        path: "/tools/documents/convert/file",
        body: this.buildFormData(request, loaded),
        label: "GreenPT document conversion",
      });

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
      parsed = new URL(url);
    } catch {
      throw new AssistantError("Document URL is invalid", ErrorType.PARAMS_ERROR);
    }

    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      isPrivateHostname(parsed.hostname)
    ) {
      throw new AssistantError("Document URL must be a public HTTP(S) URL", ErrorType.PARAMS_ERROR);
    }

    const response = await fetch(parsed, { redirect: "error" });

    if (!response.ok) {
      throw new AssistantError(
        await formatProviderError(response, "Failed to download document"),
        ErrorType.EXTERNAL_API_ERROR,
      );
    }

    const declaredLength = Number(response.headers.get("content-length") ?? 0);

    assertDocumentSize(declaredLength);

    const bytes = new Uint8Array(await response.arrayBuffer());

    assertDocumentSize(bytes.byteLength);

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
      new Blob([loaded.bytes as BlobPart], { type: loaded.mimeType }),
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
