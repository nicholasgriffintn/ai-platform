import {
  DECISION_MEDIA_MAX_BYTES,
  DECISION_MEDIA_TYPES,
  getSourceMediaType,
} from "@ngriffin_uk/polychat-schemas";
import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { StorageService } from "~/infrastructure/storage";
import { convertBlobToMarkdownViaCloudflare } from "~/modules/documents/application/convert";
import type { SourceRecord } from "~/modules/sources/infrastructure/SourceRepository";

const READABLE_IMAGE_TYPES: readonly string[] = DECISION_MEDIA_TYPES.images;

export function isSourcePdf(source: Pick<SourceRecord, "mime_type" | "storage_key">): boolean {
  return Boolean(source.storage_key) && source.mime_type === "application/pdf";
}

export function isSourceImage(source: Pick<SourceRecord, "mime_type" | "storage_key">): boolean {
  return Boolean(source.storage_key) && getSourceMediaType(source.mime_type) === "image";
}

export async function readSourceImageDataUrl(
  context: ServiceContext,
  source: SourceRecord,
): Promise<string> {
  const mimeType = source.mime_type?.toLowerCase() ?? "";

  if (!source.storage_key || !READABLE_IMAGE_TYPES.includes(mimeType)) {
    throw new AssistantError(
      "Only JPEG, PNG and WebP photos can be read. Save it in one of those and upload it again.",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const object = await StorageService.forPrivateAssets(context).getObjectBody(source.storage_key);

  if (!object) {
    throw new AssistantError("The photo is missing from storage", ErrorType.NOT_FOUND, 404);
  }

  const bytes = await object.arrayBuffer();

  if (bytes.byteLength > DECISION_MEDIA_MAX_BYTES.images) {
    throw new AssistantError(
      `This photo is over ${DECISION_MEDIA_MAX_BYTES.images / (1024 * 1024)} MB. Upload a smaller copy to read it.`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return `data:${mimeType};base64,${bufferToBase64(bytes)}`;
}

export async function readSourcePdfText(
  context: ServiceContext,
  source: SourceRecord,
): Promise<string> {
  const object = source.storage_key
    ? await StorageService.forPrivateAssets(context).getObjectBody(source.storage_key)
    : null;

  if (!object) {
    throw new AssistantError("The PDF is missing from storage", ErrorType.NOT_FOUND, 404);
  }

  const { result, error } = await convertBlobToMarkdownViaCloudflare(
    context.env,
    new Blob([await object.arrayBuffer()], { type: "application/pdf" }),
    source.filename ?? source.title,
  );

  if (!result?.trim()) {
    throw new AssistantError(
      error ? `The PDF could not be read: ${error}` : "There is no text in this PDF to read",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  return result;
}
