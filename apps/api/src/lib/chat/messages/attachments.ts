import type { Attachment } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const DEFAULT_MAX_ATTACHMENT_COUNT = 10;
const DEFAULT_MAX_ATTACHMENT_TOTAL_SIZE = 1024 * 1024;

type AttachmentContentPart =
  | {
      type: "image_url";
      source_id?: string;
      image_url: { url: string; detail?: "auto" | "low" | "high" };
    }
  | { type: "document_url"; source_id?: string; document_url: { url: string; name?: string } }
  | {
      type: "markdown_document";
      source_id?: string;
      markdown_document: { markdown: string; name?: string };
    }
  | { type: string; [key: string]: unknown };

export interface ParsedAttachments {
  imageAttachments: Attachment[];
  documentAttachments: Attachment[];
  markdownAttachments: Attachment[];
}

export interface ResolvedAttachments extends ParsedAttachments {
  allAttachments: Attachment[];
}

function isImagePart(
  part: AttachmentContentPart,
): part is Extract<AttachmentContentPart, { type: "image_url" }> {
  return part.type === "image_url" && Boolean((part as { image_url?: unknown }).image_url);
}

function isDocumentPart(
  part: AttachmentContentPart,
): part is Extract<AttachmentContentPart, { type: "document_url" }> {
  return part.type === "document_url" && Boolean((part as { document_url?: unknown }).document_url);
}

function isMarkdownPart(
  part: AttachmentContentPart,
): part is Extract<AttachmentContentPart, { type: "markdown_document" }> {
  return (
    part.type === "markdown_document" &&
    Boolean((part as { markdown_document?: unknown }).markdown_document)
  );
}

export function parseAttachments(contents: readonly unknown[]): ParsedAttachments {
  const parts = contents as readonly AttachmentContentPart[];

  return {
    imageAttachments: parts.filter(isImagePart).map((part): Attachment => {
      const attachment: Attachment = {
        type: "image",
        url: part.image_url.url,
        detail: part.image_url.detail === "auto" ? undefined : part.image_url.detail,
      };

      if (part.source_id) {
        attachment.sourceId = part.source_id;
      }

      return attachment;
    }),
    documentAttachments: parts.filter(isDocumentPart).map((part): Attachment => {
      const attachment: Attachment = {
        type: "document",
        url: part.document_url.url,
        name: part.document_url.name,
      };

      if (part.source_id) {
        attachment.sourceId = part.source_id;
      }

      return attachment;
    }),
    markdownAttachments: parts.filter(isMarkdownPart).map((part): Attachment => {
      const attachment: Attachment = {
        type: "markdown_document",
        markdown: part.markdown_document.markdown,
        name: part.markdown_document.name,
      };

      if (part.source_id) {
        attachment.sourceId = part.source_id;
      }

      return attachment;
    }),
  };
}

export function dedupeAttachments(attachments: Attachment[]): Attachment[] {
  const seen = new Set<string>();

  return attachments.filter((attachment) => {
    const key = attachment.url ?? attachment.markdown ?? "";

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}

export function enforceAttachmentLimits(
  attachments: Attachment[],
  maxCount = DEFAULT_MAX_ATTACHMENT_COUNT,
  maxTotalSize = DEFAULT_MAX_ATTACHMENT_TOTAL_SIZE,
): void {
  if (attachments.length > maxCount) {
    throw new AssistantError(
      `Too many attachments (${attachments.length}), limit is ${maxCount}`,
      ErrorType.PARAMS_ERROR,
    );
  }

  const totalSize = attachments.reduce(
    (total, attachment) =>
      total +
      (attachment.markdown?.length ?? 0) +
      (attachment.url?.length ?? 0) +
      (attachment.name?.length ?? 0),
    0,
  );

  if (totalSize > maxTotalSize) {
    throw new AssistantError(
      `Attachments size too large (${totalSize} chars), limit is ${maxTotalSize}`,
      ErrorType.PARAMS_ERROR,
    );
  }
}

export function getAllAttachments(contents: readonly unknown[]): ResolvedAttachments {
  const parsed = parseAttachments(contents);
  const imageAttachments = dedupeAttachments(parsed.imageAttachments);
  const documentAttachments = dedupeAttachments(parsed.documentAttachments);
  const markdownAttachments = dedupeAttachments(parsed.markdownAttachments);
  const allAttachments = [...imageAttachments, ...documentAttachments, ...markdownAttachments];

  enforceAttachmentLimits(allAttachments);

  return {
    imageAttachments,
    documentAttachments,
    markdownAttachments,
    allAttachments,
  };
}
