import type { Message, MessageContent } from "~/types";
import { isRecord } from "~/utils/objects";

function toAttachmentContent(value: unknown): MessageContent | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  const name = typeof value.name === "string" ? value.name : undefined;
  const sourceId = typeof value.sourceId === "string" ? value.sourceId : undefined;

  switch (value.type) {
    case "image":
      if (typeof value.url !== "string") {
        return null;
      }

      return {
        type: "image_url",
        ...(sourceId ? { source_id: sourceId } : {}),
        image_url: {
          url: value.url,
          ...(value.detail === "low" || value.detail === "high" ? { detail: value.detail } : {}),
        },
      };
    case "document":
      if (typeof value.url !== "string") {
        return null;
      }

      return {
        type: "document_url",
        ...(sourceId ? { source_id: sourceId } : {}),
        document_url: { url: value.url, ...(name ? { name } : {}) },
      };
    case "markdown_document":
      if (typeof value.markdown !== "string") {
        return null;
      }

      return {
        type: "markdown_document",
        ...(sourceId ? { source_id: sourceId } : {}),
        markdown_document: { markdown: value.markdown, ...(name ? { name } : {}) },
      };
    case "audio":
      if (typeof value.url !== "string") {
        return null;
      }

      return {
        type: "audio_url",
        ...(sourceId ? { source_id: sourceId } : {}),
        audio_url: { url: value.url },
      };
    case "video":
      if (typeof value.url !== "string") {
        return null;
      }

      return {
        type: "video_url",
        ...(sourceId ? { source_id: sourceId } : {}),
        video_url: { url: value.url },
      };
    default:
      return null;
  }
}

function readStoredAttachmentContent(message: Message): MessageContent[] {
  if (!isRecord(message.data) || !Array.isArray(message.data.attachments)) {
    return [];
  }

  return message.data.attachments
    .map(toAttachmentContent)
    .filter((content): content is MessageContent => content !== null);
}

export function restoreStoredAttachmentContent(messages: readonly Message[]): Message[] {
  const restoredMessages: Message[] = [];

  for (const message of messages) {
    const attachmentContent = readStoredAttachmentContent(message);
    const precedingMessage = restoredMessages.at(-1);

    if (
      attachmentContent.length === 0 ||
      !precedingMessage ||
      precedingMessage.role !== message.role ||
      typeof precedingMessage.content !== "string"
    ) {
      restoredMessages.push(message);
      continue;
    }

    restoredMessages[restoredMessages.length - 1] = {
      ...precedingMessage,
      content: [{ type: "text", text: precedingMessage.content }, ...attachmentContent],
    };
  }

  return restoredMessages;
}
