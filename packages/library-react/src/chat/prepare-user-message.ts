import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import type { MessageContent } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { normalizeMessage } from "@ngriffin_uk/polychat-library-chat/messages";
import type {
  ConversationModeMetadata,
  ToolInteractionResolution,
} from "@ngriffin_uk/polychat-schemas";

export function prepareUserMessage(
  input: string,
  attachments: readonly AttachmentData[] | undefined,
  model?: string,
  conversationMode?: ConversationModeMetadata,
  toolInteraction?: ToolInteractionResolution,
) {
  const data =
    conversationMode || toolInteraction
      ? {
          ...(conversationMode ? { conversationMode } : {}),
          ...(toolInteraction ? { toolInteraction } : {}),
        }
      : undefined;

  if (!attachments?.length) {
    return normalizeMessage({
      role: "user",
      content: input.trim(),
      id: crypto.randomUUID(),
      created: Date.now(),
      model,
      data,
    });
  }

  const contentItems: MessageContent[] = [
    {
      type: "text",
      text: input.trim(),
    },
  ];

  for (const attachment of attachments) {
    if (attachment.type === "image") {
      contentItems.push({
        type: "image_url",
        ...(attachment.sourceId ? { source_id: attachment.sourceId } : {}),
        image_url: {
          url: attachment.data,
          detail: "auto",
        },
      });
    } else if (attachment.type === "document") {
      contentItems.push({
        type: "document_url",
        ...(attachment.sourceId ? { source_id: attachment.sourceId } : {}),
        document_url: {
          url: attachment.data,
          name: attachment.name,
        },
      });
    } else if (attachment.type === "audio") {
      contentItems.push({
        type: "audio_url",
        ...(attachment.sourceId ? { source_id: attachment.sourceId } : {}),
        audio_url: { url: attachment.data },
      });
    } else if (attachment.type === "markdown_document" && attachment.markdown) {
      contentItems.push({
        type: "markdown_document",
        ...(attachment.sourceId ? { source_id: attachment.sourceId } : {}),
        markdown_document: {
          markdown: attachment.markdown,
          name: attachment.name,
        },
      });
    } else if (attachment.type === "selection" && attachment.selection.selectedText) {
      contentItems.push({
        type: "selection",
        selection: attachment.selection,
      });
    }
  }

  return normalizeMessage({
    role: "user",
    content: contentItems,
    id: crypto.randomUUID(),
    created: Date.now(),
    model,
    data,
  });
}
