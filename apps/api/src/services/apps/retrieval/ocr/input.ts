import type { OcrInput } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { OcrDocument } from "~/lib/providers/capabilities/ocr/types";
import { readPrivateFile } from "~/lib/storage/read-resource";
import { bufferToBase64 } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";

export const MAX_OCR_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_OCR_DOCUMENT_BYTES = 25 * 1024 * 1024;
const SUPPORTED_OCR_IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function getOcrInputKind(mimeType: string): "document" | "image" | null {
  if (mimeType === "application/pdf") {
    return "document";
  }

  return SUPPORTED_OCR_IMAGE_MIME_TYPES.has(mimeType) ? "image" : null;
}

export interface ResolvedOcrInput {
  document: OcrDocument;
  sourceId?: string;
  parentOutputId?: string;
}

export async function resolveOcrInput(params: {
  context: ServiceContext;
  userId: number;
  projectId?: string;
  input: OcrInput;
}): Promise<ResolvedOcrInput> {
  if (params.input.type === "document_url" || params.input.type === "image_url") {
    return { document: params.input };
  }

  const kind = params.input.type === "source" ? "source" : "output";
  const resourceId =
    params.input.type === "source" ? params.input.source_id : params.input.output_id;
  const { record, object } = await readPrivateFile({
    context: params.context,
    kind,
    resourceId,
    userId: params.userId,
  });

  if ((record.project_id ?? undefined) !== params.projectId) {
    throw new AssistantError(
      "OCR input and output must use the same project scope",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  if (!params.projectId && record.created_by_user_id !== params.userId) {
    throw new AssistantError(
      "OCR input must be owned by the current user",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const mimeType = record.mime_type.toLowerCase();
  const inputKind = getOcrInputKind(mimeType);

  if (!inputKind) {
    throw new AssistantError(
      "OCR input must be a PDF or a supported raster image (AVIF, JPEG, PNG, or WebP)",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const maxBytes = inputKind === "document" ? MAX_OCR_DOCUMENT_BYTES : MAX_OCR_IMAGE_BYTES;

  if (object.size > maxBytes) {
    const limit = maxBytes === MAX_OCR_DOCUMENT_BYTES ? "25MB" : "10MB";

    throw new AssistantError(`OCR input must be ${limit} or smaller`, ErrorType.PARAMS_ERROR, 400);
  }

  const data = await object.arrayBuffer();

  if (data.byteLength > maxBytes) {
    const limit = maxBytes === MAX_OCR_DOCUMENT_BYTES ? "25MB" : "10MB";

    throw new AssistantError(`OCR input must be ${limit} or smaller`, ErrorType.PARAMS_ERROR, 400);
  }

  const dataUrl = `data:${mimeType};base64,${bufferToBase64(data)}`;
  const document: OcrDocument =
    inputKind === "document"
      ? {
          type: "document_url",
          document_url: dataUrl,
          document_name: record.filename ?? undefined,
        }
      : { type: "image_url", image_url: dataUrl };

  return {
    document,
    ...(kind === "source" ? { sourceId: resourceId } : { parentOutputId: resourceId }),
  };
}
