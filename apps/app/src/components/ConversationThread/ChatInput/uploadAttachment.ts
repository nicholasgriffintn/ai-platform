import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import type { MarkdownConversionOptions } from "@ngriffin_uk/polychat-schemas";

import { apiService } from "~/lib/api/api-service";
import type { UploadFileOptions } from "~/lib/api/services/upload-service";

const SUPPORTED_MARKDOWN_IMAGE_LANGUAGES = [
  "en",
  "it",
  "de",
  "es",
  "fr",
  "pt",
] as const satisfies ReadonlyArray<
  NonNullable<NonNullable<MarkdownConversionOptions["image"]>["descriptionLanguage"]>
>;

type MarkdownDescriptionLanguage = (typeof SUPPORTED_MARKDOWN_IMAGE_LANGUAGES)[number];

const CODE_LIKE_EXTENSION_PATTERN =
  /\.(ts|tsx|js|jsx|json|py|go|java|rb|php|rs|cs|kt|swift|scala|sh|yml|yaml|sql|toml|c|cc|cpp|cxx|hpp|h)$/i;

export interface ComposerAttachmentUploadContext {
  isImageModel: boolean;
  isMultimodalModel: boolean;
  isTextToImageOnlyModel: boolean;
  supportsAudio: boolean;
  supportsDocuments: boolean;
  projectId?: string;
}

export type ComposerAttachmentUploadResult =
  | {
      attachment: AttachmentData;
    }
  | {
      error: string;
    };

function isMarkdownDescriptionLanguage(value: string): value is MarkdownDescriptionLanguage {
  return SUPPORTED_MARKDOWN_IMAGE_LANGUAGES.some((language) => language === value);
}

function getPreferredMarkdownImageLanguage(): MarkdownDescriptionLanguage | undefined {
  if (typeof navigator === "undefined") {
    return undefined;
  }

  const preferredLanguage = navigator.language.split("-")[0]?.toLowerCase();

  return preferredLanguage && isMarkdownDescriptionLanguage(preferredLanguage)
    ? preferredLanguage
    : undefined;
}

function isCodeLikeFile(file: File) {
  const isMarkdownDocument = file.type === "text/markdown" || /\.mdx?$/i.test(file.name);

  return (
    !isMarkdownDocument &&
    (file.type.startsWith("text/") ||
      file.type === "application/javascript" ||
      file.type === "application/typescript" ||
      CODE_LIKE_EXTENSION_PATTERN.test(file.name))
  );
}

function getUploadOptions(
  context: ComposerAttachmentUploadContext,
  options?: UploadFileOptions,
): UploadFileOptions | undefined {
  return context.projectId ? { ...options, projectId: context.projectId } : options;
}

function uploadFile(
  file: File,
  fileType: "image" | "document" | "audio" | "code",
  context: ComposerAttachmentUploadContext,
  options?: UploadFileOptions,
) {
  const uploadOptions = getUploadOptions(context, options);

  return uploadOptions
    ? apiService.uploadFile(file, fileType, uploadOptions)
    : apiService.uploadFile(file, fileType);
}

function markdownDocumentAttachment({
  file,
  markdown,
  name,
  url,
}: {
  file: File;
  markdown: string;
  name?: string;
  url: string;
}): AttachmentData {
  return {
    type: "markdown_document",
    data: url,
    name: name || file.name,
    markdown,
  };
}

export async function uploadComposerAttachment(
  file: File,
  context: ComposerAttachmentUploadContext,
): Promise<ComposerAttachmentUploadResult> {
  if (context.isTextToImageOnlyModel) {
    return { error: "This model does not support file uploads" };
  }

  if (context.isImageModel && !file.type.startsWith("image/")) {
    return { error: "This model only supports image uploads" };
  }

  if (file.type.startsWith("image/")) {
    if (!context.isMultimodalModel && !context.isImageModel) {
      if (!context.supportsDocuments) {
        return { error: "This model does not support image uploads" };
      }

      const descriptionLanguage = getPreferredMarkdownImageLanguage();
      const { url, name, markdown, type } = await uploadFile(file, "image", context, {
        convertToMarkdown: true,
        conversionOptions: descriptionLanguage
          ? {
              image: {
                descriptionLanguage,
              },
            }
          : undefined,
      });

      if (type === "markdown_document" && markdown) {
        return {
          attachment: markdownDocumentAttachment({ file, markdown, name, url }),
        };
      }

      return { error: "This model does not support image uploads and conversion failed" };
    }

    const { url } = await uploadFile(file, "image", context);

    return {
      attachment: {
        type: "image",
        data: url,
        name: file.name,
      },
    };
  }

  if (file.type.startsWith("audio/")) {
    if (!context.supportsAudio) {
      return { error: "This model does not support audio uploads" };
    }

    const { url } = await uploadFile(file, "audio", context);

    return {
      attachment: {
        type: "audio",
        data: url,
        name: file.name,
      },
    };
  }

  if (isCodeLikeFile(file)) {
    const { url, name, markdown, type } = await uploadFile(file, "code", context);

    if (type === "markdown_document" && markdown) {
      return {
        attachment: markdownDocumentAttachment({ file, markdown, name, url }),
      };
    }
  }

  if (file.type === "application/pdf") {
    if (context.supportsDocuments) {
      const { url, name } = await uploadFile(file, "document", context);

      return {
        attachment: {
          type: "document",
          data: url,
          name: name || file.name,
        },
      };
    }

    const { url, name, markdown, type } = await uploadFile(file, "document", context, {
      convertToMarkdown: true,
    });

    if (type === "markdown_document" && markdown) {
      return {
        attachment: markdownDocumentAttachment({ file, markdown, name, url }),
      };
    }

    return { error: "This model does not support document uploads and conversion failed" };
  }

  const { url, name, markdown, type } = await uploadFile(file, "document", context, {
    convertToMarkdown: true,
  });

  if (type === "markdown_document" && markdown) {
    return {
      attachment: markdownDocumentAttachment({ file, markdown, name, url }),
    };
  }

  return { error: "Unsupported file type or conversion failed" };
}
