import { convertToMarkdownViaCloudflare } from "~/lib/documentConverter";
import { StorageService } from "~/lib/storage";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "UPLOADS_SERVICE" });

export async function handleFileUpload(
  env: IEnv,
  userId: number,
  formData: FormData,
): Promise<{
  url: string;
  type: string;
  name: string;
  markdown?: string;
}> {
  const file = formData.get("file") as File | null;
  const fileType = formData.get("file_type") as
    | "image"
    | "document"
    | "audio"
    | null;

  if (!file) {
    throw new AssistantError("No file uploaded", ErrorType.PARAMS_ERROR, 400);
  }
  if (!fileType || !["image", "document", "audio"].includes(fileType)) {
    throw new AssistantError(
      "Invalid file type. Must be 'image', 'document', or 'audio'",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const allowedMimeTypes: Record<string, string[]> = {
    image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    document: [
      "application/pdf",
      "text/html",
      "application/xml",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel.sheet.macroenabled.12",
      "application/vnd.ms-excel.sheet.binary.macroenabled.12",
      "application/vnd.ms-excel",
      "application/vnd.oasis.opendocument.spreadsheet",
      "text/csv",
      "application/vnd.apple.numbers",
    ],
    audio: ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav", "audio/mp4"],
  };

  if (!allowedMimeTypes[fileType].includes(file.type)) {
    throw new AssistantError(
      `Invalid file type. Allowed types for ${fileType}: ${allowedMimeTypes[fileType].join(", ")}`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const isPdf = file.type === "application/pdf";
  const convertFlag = formData.get("convert_to_markdown") as string | null;
  const shouldConvert =
    fileType === "document" && (!isPdf || convertFlag === "true");

  const fileExtension = file.type.split("/")[1];
  const key = `uploads/${userId}/${fileType}s/${crypto.randomUUID()}.${fileExtension}`;

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (bufferError) {
    logger.error("Failed to convert file to arrayBuffer", {
      error:
        bufferError instanceof Error
          ? bufferError.message
          : String(bufferError),
      stack: bufferError instanceof Error ? bufferError.stack : undefined,
    });
    throw new AssistantError(
      "Failed to process file data",
      ErrorType.UNKNOWN_ERROR,
      500,
    );
  }

  try {
    const storageService = new StorageService(env.ASSETS_BUCKET);
    const uploaded = await storageService.uploadObject(key, arrayBuffer, {
      contentType: file.type,
    });
    if (!uploaded) {
      throw new Error("Failed to upload file to storage");
    }
  } catch (storageError) {
    logger.error("Failed to upload file to storage", {
      error:
        storageError instanceof Error
          ? storageError.message
          : String(storageError),
      stack: storageError instanceof Error ? storageError.stack : undefined,
      key,
    });
    throw new AssistantError(
      "Failed to store file",
      ErrorType.EXTERNAL_API_ERROR,
      500,
    );
  }

  const baseUrl = env.PUBLIC_ASSETS_URL ?? "";
  const fileUrl = `${baseUrl}/${key}`;

  let markdownContent = "";
  if (shouldConvert) {
    try {
      const { result, error } = await convertToMarkdownViaCloudflare(
        env,
        fileUrl,
        file.name,
      );
      if (error) {
        logger.error("Markdown conversion error", { error });
      } else if (result) {
        markdownContent = result;
      }
    } catch (markdownError) {
      logger.error("Error during markdown conversion", {
        error:
          markdownError instanceof Error
            ? markdownError.message
            : String(markdownError),
        stack: markdownError instanceof Error ? markdownError.stack : undefined,
      });
    }
  }

  const response: {
    url: string;
    type: string;
    name: string;
    markdown?: string;
  } = {
    url: fileUrl,
    type: markdownContent ? "markdown_document" : fileType,
    name: file.name,
  };

  if (markdownContent) {
    response.markdown = markdownContent;
  }

  return response;
}
