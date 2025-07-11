import type { Attachment } from "~/types";
import type { ToolCall, ToolEventPayload } from "~/types";
import { ToolStage } from "~/types";
import type { Message } from "~/types/chat";
import { AssistantError, ErrorType } from "~/utils/errors";

export function checkContextWindowLimits(
  messages: Message[],
  newContent: string,
  modelConfig: any,
): void {
  const MAX_CONTEXT_LENGTH = modelConfig?.contextWindow || 8000;

  const estimateTokens = (text: string): number => {
    return Math.ceil(text.length / 4);
  };

  let existingTokenCount = 0;
  for (const msg of messages) {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    existingTokenCount += estimateTokens(content);

    existingTokenCount += 4;
  }

  const newContentTokens = estimateTokens(newContent);

  const totalTokens = existingTokenCount + newContentTokens;

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

/**
 * Remove duplicate attachments based on URL or markdown content.
 * @param attachments - The attachments to dedupe
 * @returns The deduplicated attachments
 */
export function dedupeAttachments(attachments: Attachment[]): Attachment[] {
  const seen = new Set<string>();
  return attachments.filter((att) => {
    const key = att.url ?? att.markdown ?? "";
    if (!key) {
      return false;
    }
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Enforce limits on the number and total size of attachments.
 * @param attachments - The attachments to enforce limits on
 * @param maxCount - The maximum number of attachments
 * @param maxTotalSize - The maximum total size of attachments
 */
export function enforceAttachmentLimits(
  attachments: Attachment[],
  maxCount = 10,
  maxTotalSize = 1024 * 1024, // ~1MB total
): void {
  if (attachments.length > maxCount) {
    throw new AssistantError(
      `Too many attachments (${attachments.length}), limit is ${maxCount}`,
      ErrorType.PARAMS_ERROR,
    );
  }
  let totalSize = 0;
  for (const att of attachments) {
    if (att.markdown) totalSize += att.markdown.length;
    if (att.url) totalSize += att.url.length;
    if (att.name) totalSize += att.name.length;
  }
  if (totalSize > maxTotalSize) {
    throw new AssistantError(
      `Attachments size too large (${totalSize} chars), limit is ${maxTotalSize}`,
      ErrorType.PARAMS_ERROR,
    );
  }
}

export function getAllAttachments(contents: unknown[]): {
  imageAttachments: Attachment[];
  documentAttachments: Attachment[];
  markdownAttachments: Attachment[];
  allAttachments: Attachment[];
} {
  const {
    imageAttachments: rawImages,
    documentAttachments: rawDocs,
    markdownAttachments: rawMarkdown,
  } = parseAttachments(contents);
  const imageAttachments = dedupeAttachments(rawImages);
  const documentAttachments = dedupeAttachments(rawDocs);
  const markdownAttachments = dedupeAttachments(rawMarkdown);
  const allAttachments = [
    ...imageAttachments,
    ...documentAttachments,
    ...markdownAttachments,
  ];
  enforceAttachmentLimits(allAttachments);
  return {
    imageAttachments,
    documentAttachments,
    markdownAttachments,
    allAttachments,
  };
}

export function pruneMessagesToFitContext(
  messages: Message[],
  newContent: string,
  modelConfig: any,
): Message[] {
  const MAX_CONTEXT_LENGTH = modelConfig?.contextWindow || 8000;

  const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

  const pruned = [...messages];

  let existingTokens = pruned.reduce((sum, msg) => {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.find((c) => c.type === "text")?.text || ""
          : JSON.stringify(msg.content);
    return sum + estimateTokens(content) + 4;
  }, 0);

  const newTokens = estimateTokens(newContent);
  let totalTokens = existingTokens + newTokens;

  while (totalTokens > MAX_CONTEXT_LENGTH && pruned.length > 0) {
    const removed = pruned.shift()!;
    const content =
      typeof removed.content === "string"
        ? removed.content
        : Array.isArray(removed.content)
          ? removed.content.find((c) => c.type === "text")?.text || ""
          : JSON.stringify(removed.content);
    existingTokens -= estimateTokens(content) + 4;
    totalTokens = existingTokens + newTokens;
  }

  return pruned;
}

export function sanitiseInput(input: string): string {
  const codeBlocks: string[] = [];
  let codeBlockCount = 0;

  const withoutCodeBlocks = input.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `__CODE_BLOCK_${codeBlockCount}__`;
    codeBlocks.push(match);
    codeBlockCount++;
    return placeholder;
  });

  const sanitized = withoutCodeBlocks
    // Remove instruction formats
    .replace(/<\/?(?:INST|system|assistant|human|user|ai)[^>]*>/gi, "")
    .replace(/\[\/?(?:INST|system|assistant|human|user|ai)\]/gi, "")
    // Remove sentinel tokens
    .replace(/<\/?s>/gi, "")
    // Escape template syntax
    .replace(/{{/g, "{ {")
    .replace(/}}/g, "} }")
    // Handle angle brackets that might be part of XML-style instructions
    .replace(
      /<([a-zA-Z][a-zA-Z0-9]*(\s+[a-zA-Z][a-zA-Z0-9]*=("[^"]*"|'[^']*'|[^>\s]+))*)\s*\/?>/g,
      "`&lt;$1&gt;`",
    )
    // Normalize whitespace (but preserve newlines)
    .replace(/[ \t]+/g, " ");

  // Reinsert code blocks
  const result = sanitized.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => {
    return codeBlocks[Number.parseInt(index)];
  });

  return result.trim();
}

export function sanitiseMessages(messages: Message[]): Message[] {
  return messages.map((msg) => {
    if (msg.role === "user" || msg.role === "developer") {
      if (typeof msg.content === "string") {
        return { ...msg, content: sanitiseInput(msg.content) };
      }
      if (Array.isArray(msg.content)) {
        const sanitisedContent = msg.content.map((part) =>
          part.type === "text" && part.text
            ? { ...part, text: sanitiseInput(part.text) }
            : part,
        );
        return { ...msg, content: sanitisedContent };
      }
    }
    return msg;
  });
}

/**
 * Constructs payload for tool events based on stage
 * @param toolCall - The tool call
 * @param stage - The stage of the tool call
 * @param parameters - Optional string containing the parameters for delta stage
 * @returns The payload object
 */
export function getToolEventPayload(
  toolCall: ToolCall,
  stage: ToolStage,
  parameters?: string,
): ToolEventPayload {
  const payload: ToolEventPayload = {
    tool_id: toolCall.id,
  };

  switch (stage) {
    case ToolStage.START:
      payload.tool_name = toolCall.function?.name || "";
      break;
    case ToolStage.DELTA:
      payload.parameters = parameters || "{}";
      break;
    case ToolStage.STOP:
      break;
    default: {
      const exhaustiveCheck: never = stage;
      throw new AssistantError(
        `Unsupported ToolStage: ${exhaustiveCheck}`,
        ErrorType.INTERNAL_ERROR,
      );
    }
  }

  return payload;
}
