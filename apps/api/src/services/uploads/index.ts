import {
  type MarkdownConversionOptions,
  markdownConversionOptionsSchema,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { convertBlobToMarkdownViaCloudflare } from "~/lib/documentConverter";
import { StorageService, type StoredSourceFileResult } from "~/lib/storage";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/uploads" });

const UPLOAD_SIZE_LIMITS: Record<
  "image" | "document" | "audio" | "code",
  { maxBytes: number; message: string }
> = {
  image: { maxBytes: 10 * 1024 * 1024, message: "Image files must be 10MB or smaller" },
  document: { maxBytes: 25 * 1024 * 1024, message: "Document files must be 25MB or smaller" },
  audio: { maxBytes: 50 * 1024 * 1024, message: "Audio files must be 50MB or smaller" },
  code: { maxBytes: 200 * 1024, message: "Code files must be 200KB or smaller" },
};

const CODE_EXTENSION_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  py: "python",
  go: "go",
  java: "java",
  rb: "ruby",
  php: "php",
  rs: "rust",
  cs: "csharp",
  kt: "kotlin",
  swift: "swift",
  scala: "scala",
  sh: "bash",
  bash: "bash",
  yml: "yaml",
  yaml: "yaml",
  sql: "sql",
  toml: "toml",
  c: "c",
  h: "c",
  cc: "cpp",
  cpp: "cpp",
  cxx: "cpp",
  hpp: "cpp",
};

function parseConversionOptions(
  value: FormDataEntryValue | null,
): MarkdownConversionOptions | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new AssistantError(
      "conversion_options must be a JSON object",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  let parsedOptions: unknown;

  try {
    parsedOptions = JSON.parse(value);
  } catch {
    throw new AssistantError("conversion_options must be valid JSON", ErrorType.PARAMS_ERROR, 400);
  }

  const validationResult = markdownConversionOptionsSchema.safeParse(parsedOptions);

  if (!validationResult.success) {
    const issue = validationResult.error.issues[0];

    throw new AssistantError(
      issue?.message || "Invalid conversion_options",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return validationResult.data;
}

function buildMarkdownConversionOptions(
  mimeType: string,
  fileUrl: string,
  conversionOptions?: MarkdownConversionOptions,
): MarkdownConversionOptions | undefined {
  let nextOptions = conversionOptions ? { ...conversionOptions } : undefined;

  if (mimeType === "text/html" && !nextOptions?.html?.hostname) {
    try {
      nextOptions = {
        ...nextOptions,
        html: {
          ...nextOptions?.html,
          hostname: new URL(fileUrl).host,
        },
      };
    } catch {
      // Ignore invalid asset URLs and let Cloudflare use its default handling.
    }
  }

  if (mimeType === "application/pdf" && nextOptions?.pdf?.metadata === undefined) {
    nextOptions = {
      ...nextOptions,
      pdf: {
        ...nextOptions?.pdf,
        metadata: false,
      },
    };
  }

  return nextOptions;
}

export async function handleFileUpload(
  context: ServiceContext,
  userId: number,
  formData: FormData,
): Promise<{
  sourceId: string;
  url: string;
  key: string;
  type: string;
  name: string;
  markdown?: string;
}> {
  const file = formData.get("file") as File | null;
  const fileType = formData.get("file_type") as "image" | "document" | "audio" | "code" | null;
  const projectIdValue = formData.get("project_id");
  const projectId =
    typeof projectIdValue === "string" && projectIdValue.trim() ? projectIdValue.trim() : undefined;

  if (projectId) {
    await requireProjectAccess(context, projectId);
  }

  if (!file) {
    throw new AssistantError("No file uploaded", ErrorType.PARAMS_ERROR, 400);
  }

  if (!fileType || !["image", "document", "audio", "code"].includes(fileType)) {
    throw new AssistantError(
      "Invalid file type. Must be 'image', 'document', 'audio', or 'code'",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const nameParts = file.name.split(".");
  const inferredExtension = nameParts.length > 1 ? nameParts.pop().toLowerCase() : "";

  const allowedMimeTypes: Record<string, string[]> = {
    image: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp"],
    document: [
      "text/markdown",
      "application/pdf",
      "text/html",
      "application/xml",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel.sheet.macroenabled.12",
      "application/vnd.ms-excel.sheet.binary.macroenabled.12",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.oasis.opendocument.spreadsheet",
      "application/vnd.oasis.opendocument.text",
      "text/csv",
      "application/vnd.apple.numbers",
    ],
    audio: ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav", "audio/mp4"],
    code: [
      "text/javascript",
      "application/javascript",
      "text/typescript",
      "application/typescript",
      "text/plain",
      "application/json",
      "text/yaml",
      "application/x-yaml",
      "text/x-python",
      "application/x-python",
      "text/x-go",
      "text/x-java-source",
      "text/x-ruby",
      "application/x-ruby",
      "application/x-php",
      "text/x-php",
      "text/x-csrc",
      "text/x-c++src",
      "text/x-shellscript",
      "text/x-sql",
      "application/sql",
    ],
  };

  if (fileType === "code") {
    const isAllowedByMime = allowedMimeTypes.code.includes(file.type);
    const isOctetStreamWithKnownExtension =
      file.type === "application/octet-stream" &&
      Boolean(inferredExtension && CODE_EXTENSION_TO_LANG[inferredExtension]);

    if (!isAllowedByMime && !isOctetStreamWithKnownExtension) {
      throw new AssistantError(
        `Invalid file type ${file.type}. Allowed types for code: ${[...allowedMimeTypes.code, "application/octet-stream (with known code extension)"].join(", ")}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  } else {
    if (!allowedMimeTypes[fileType].includes(file.type)) {
      throw new AssistantError(
        `Invalid file type ${file.type}. Allowed types for ${fileType}: ${allowedMimeTypes[fileType].join(", ")}`,
        ErrorType.PARAMS_ERROR,
        400,
      );
    }
  }

  let arrayBuffer: ArrayBuffer;

  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (bufferError) {
    logger.error("Failed to convert file to arrayBuffer", {
      error: bufferError instanceof Error ? bufferError.message : String(bufferError),
      stack: bufferError instanceof Error ? bufferError.stack : undefined,
    });
    throw new AssistantError("Failed to process file data", ErrorType.UNKNOWN_ERROR, 500);
  }

  const sizeLimit = UPLOAD_SIZE_LIMITS[fileType];

  if (arrayBuffer.byteLength > sizeLimit.maxBytes) {
    throw new AssistantError(sizeLimit.message, ErrorType.PARAMS_ERROR, 400);
  }

  const isPdf = file.type === "application/pdf";
  const convertFlag = formData.get("convert_to_markdown") as string | null;
  const conversionOptions = parseConversionOptions(formData.get("conversion_options"));
  const shouldConvert =
    (fileType === "document" && (!isPdf || convertFlag === "true")) ||
    (fileType === "image" && convertFlag === "true");

  const mimeExtension = (file.type.split("/")[1] || "").toLowerCase();
  const fileExtension = fileType === "code" ? inferredExtension || mimeExtension : mimeExtension;
  const key = `uploads/${userId}/${fileType}s/${generateId()}.${fileExtension}`;

  let storedSource: StoredSourceFileResult;

  try {
    storedSource = await StorageService.forPrivateAssets(context).storeSourceFile({
      key,
      data: arrayBuffer,
      createdByUserId: userId,
      projectId,
      title: file.name,
      mimeType: file.type,
      filename: file.name,
      byteSize: arrayBuffer.byteLength,
    });
  } catch (storageError) {
    logger.error("Failed to upload file to storage", {
      error: storageError instanceof Error ? storageError.message : String(storageError),
      stack: storageError instanceof Error ? storageError.stack : undefined,
      key,
    });
    throw new AssistantError("Failed to store file", ErrorType.EXTERNAL_API_ERROR, 500);
  }

  const fileUrl = storedSource.url;
  const effectiveConversionOptions = shouldConvert
    ? buildMarkdownConversionOptions(file.type, fileUrl, conversionOptions)
    : undefined;

  let markdownContent = "";

  if (shouldConvert) {
    try {
      const { result, error } = await convertBlobToMarkdownViaCloudflare(
        context.env,
        file,
        file.name,
        effectiveConversionOptions,
      );

      if (error) {
        logger.error("Markdown conversion error", { error });
      } else if (result) {
        markdownContent = result;
      }
    } catch (markdownError) {
      logger.error("Error during markdown conversion", {
        error: markdownError instanceof Error ? markdownError.message : String(markdownError),
        stack: markdownError instanceof Error ? markdownError.stack : undefined,
      });
    }
  }

  if (fileType === "code") {
    try {
      const rawText = await file.text();
      const lang = CODE_EXTENSION_TO_LANG[(inferredExtension || "").toLowerCase()] || "";
      const fence = lang ? `\`\`\`${lang}` : "```";

      markdownContent = `${fence}\n${rawText}\n\`\`\``;
    } catch (err) {
      logger.error("Failed to read code file as text", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await context.repositories.sources.updateSource(storedSource.sourceId, {
    content: markdownContent || null,
    metadata: { uploadType: fileType, convertedToMarkdown: Boolean(markdownContent) },
  });

  const response: {
    sourceId: string;
    url: string;
    key: string;
    type: string;
    name: string;
    markdown?: string;
  } = {
    sourceId: storedSource.sourceId,
    url: fileUrl,
    key: storedSource.key,
    type: markdownContent ? "markdown_document" : fileType,
    name: file.name,
  };

  if (markdownContent) {
    response.markdown = markdownContent;
  }

  return response;
}
