import type { Attachment } from "~/types";
import type { Message } from "~/types/chat";
import { AssistantError, ErrorType } from "~/utils/errors";

export function checkContextWindowLimits(
  messages: Message[],
  newContent: string,
  modelConfig: any,
): void {
  // Default max context if not specified in model config (conservative estimate)
  const MAX_CONTEXT_LENGTH = modelConfig?.contextWindow || 8000;

  // Estimate token count based on characters (rough approximation)
  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4);
  };

  // Calculate existing conversation token count
  let existingTokenCount = 0;
  for (const msg of messages) {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    existingTokenCount += estimateTokens(content);

    // Add extra tokens for role prefixes and message separators
    existingTokenCount += 4;
  }

  // Calculate new content token count
  const newContentTokens = estimateTokens(newContent);

  // Total tokens
  const totalTokens = existingTokenCount + newContentTokens;

  // Check if we exceed limits
  if (totalTokens > MAX_CONTEXT_LENGTH) {
    throw new AssistantError(
      `Content exceeds model context window (estimated ${totalTokens} tokens, limit ${MAX_CONTEXT_LENGTH})`,
      ErrorType.CONTEXT_WINDOW_EXCEEDED,
    );
  }
}

export function parseAttachments(contents: any[]): {
  imageAttachments: Attachment[];
  documentAttachments: Attachment[];
  markdownAttachments: Attachment[];
} {
  const imageAttachments: Attachment[] = contents
    .filter(
      (
        c,
      ): c is {
        type: "image_url";
        image_url: { url: string; detail?: "auto" | "low" | "high" };
      } => c.type === "image_url" && c.image_url,
    )
    .map((c) => ({
      type: "image",
      url: c.image_url.url,
      detail: c.image_url.detail === "auto" ? undefined : c.image_url.detail,
    }));

  const documentAttachments: Attachment[] = contents
    .filter(
      (
        c,
      ): c is {
        type: "document_url";
        document_url: { url: string; name?: string };
      } => c.type === "document_url" && c.document_url,
    )
    .map((c) => ({
      type: "document",
      url: c.document_url.url,
      name: c.document_url.name,
    }));

  const markdownAttachments: Attachment[] = contents
    .filter(
      (
        c,
      ): c is {
        type: "markdown_document";
        markdown_document: { markdown: string; name?: string };
      } => c.type === "markdown_document" && c.markdown_document,
    )
    .map((c) => ({
      type: "markdown_document",
      markdown: c.markdown_document.markdown,
      name: c.markdown_document.name,
    }));

  return {
    imageAttachments,
    documentAttachments,
    markdownAttachments,
  };
}
