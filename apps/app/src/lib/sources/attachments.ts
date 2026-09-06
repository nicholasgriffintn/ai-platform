import type { AttachmentData } from "@ngriffin_uk/polychat-library-chat/attachments";
import type { Source } from "@ngriffin_uk/polychat-schemas";

export interface SourceAttachmentCapabilities {
  supportsAudio: boolean;
  supportsDocuments: boolean;
  supportsImages: boolean;
}

export function createSourceAttachment(
  source: Source,
  contentUrl: string,
  capabilities?: SourceAttachmentCapabilities,
): AttachmentData | null {
  const content = source.content?.trim();

  if (content) {
    return {
      type: "markdown_document",
      data: contentUrl,
      sourceId: source.id,
      name: source.title,
      markdown: `# ${source.title}\n\n${content}`,
    };
  }

  if (source.file?.mimeType.startsWith("image/") && capabilities?.supportsImages !== false) {
    return {
      type: "image",
      data: contentUrl,
      sourceId: source.id,
      name: source.file.filename ?? source.title,
    };
  }

  if (source.file?.mimeType.startsWith("audio/") && capabilities?.supportsAudio !== false) {
    return {
      type: "audio",
      data: contentUrl,
      sourceId: source.id,
      name: source.file.filename ?? source.title,
    };
  }

  if (source.file?.mimeType === "application/pdf" && capabilities?.supportsDocuments !== false) {
    return {
      type: "document",
      data: contentUrl,
      sourceId: source.id,
      name: source.file.filename ?? source.title,
    };
  }

  if (source.externalUri) {
    return {
      type: "markdown_document",
      data: source.externalUri,
      sourceId: source.id,
      name: source.title,
      markdown: `# ${source.title}\n\n${source.externalUri}`,
    };
  }

  return null;
}
